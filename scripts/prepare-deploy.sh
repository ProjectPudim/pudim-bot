#!/usr/bin/env bash
# Usage: scripts/prepare-deploy.sh <app> [entry]   (entry default: src/index.ts)
# Needs:    deploy/discloud/<app>.config
# Optional: deploy/discloud/<app>.externals  (packages kept out of the bundle,
#           e.g. native modules; one per line, '#' for comments)
#
# Bundles the app with bun (workspace packages + aliases inlined) into a
# Node-compatible build and places it, with discloud.config, in the output dir.
# Files under src/fluxer/ (commands, events) are loaded at RUNTIME by the
# framework (glob relative to the entry file), so each one is emitted as its own
# file at the same path; shared code is split into chunks (a single registry).
#   default          -> replaces the workspace with the build (CI only!)
#   DEPLOY_OUT=<dir> -> writes the build to <dir>, deletes nothing
set -euo pipefail

APP="${1:?usage: prepare-deploy.sh <app> [entry]}"
ENTRY="${2:-src/index.ts}"
SRC="apps/$APP"
CONFIG="deploy/discloud/$APP.config"
EXTERNALS="deploy/discloud/$APP.externals"
OUT_JS="${ENTRY%.*}.js"

for f in "$SRC/$ENTRY" "$CONFIG" bun.lock; do
  [ -f "$f" ] || { echo "Error: $f not found"; exit 1; }
done

# Bun-only APIs break on Node (the Discloud runtime)
Q="[\"']"
if grep -rEn "\\bBun\\.|${Q}bun:|import\\.meta\\.dir\\b" "$SRC/src" packages/*/src 2>/dev/null | head -n 10 | grep .; then
  echo "Warning: Bun-only APIs found above; they will fail on Node."
fi

PKGS=(); EXT_ARGS=()
if [ -f "$EXTERNALS" ]; then
  mapfile -t PKGS < <(sed 's/#.*//' "$EXTERNALS" | xargs -r -n1)
  for p in ${PKGS[@]+"${PKGS[@]}"}; do EXT_ARGS+=(--external "$p"); done
fi

# Runtime-loaded modules (framework glob ./fluxer/**), one output file each
DYN=()
if [ -d "$SRC/src/fluxer" ]; then
  mapfile -t DYN < <(find "$SRC/src/fluxer" -name '*.ts' ! -name '*.d.ts' \
    ! -name '_*' ! -name '*.test.ts' ! -name '*.spec.ts' ! -path '*/_*/*' \
    ! -path "$SRC/src/fluxer/index.ts" | sort)
fi

OUT="${DEPLOY_OUT:-$(mktemp -d)}"
rm -rf "$OUT" && mkdir -p "$OUT"

bun install --frozen-lockfile

# Runtime files of the app (assets, json, ...), without sources and secrets
rsync -a --exclude='node_modules' --exclude='.env*' --exclude='Dockerfile' \
  --exclude='package.json' --exclude='tsconfig*.json' --exclude='*.ts' --exclude='*.tsx' \
  "$SRC/" "$OUT/"

bun build "$SRC/$ENTRY" ${DYN[@]+"${DYN[@]}"} --target=node --splitting --root="$SRC" \
  --outdir="$OUT" ${EXT_ARGS[@]+"${EXT_ARGS[@]}"}
[ -f "$OUT/$OUT_JS" ] || { echo "Error: build did not produce $OUT_JS"; exit 1; }
echo "Runtime-loaded modules: ${#DYN[@]}"

# Production manifest derived from the app package.json: Discloud uses npm start,
# so keep a start script pointing at the bundled entry point. Only externals
# (native modules) are installed at runtime; workspace packages are bundled.
bun -e '
const [out, appPkgPath, ...names] = process.argv.slice(1);
const appPkg = await Bun.file(appPkgPath).json();
const pkgs = [];
for (const g of ["package.json", "apps/*/package.json", "packages/*/package.json"])
  for (const f of new Bun.Glob(g).scanSync(".")) pkgs.push(await Bun.file(f).json());
const dependencies = {};
for (const n of names) {
  const v = pkgs.map((p) => p.dependencies?.[n]).find(Boolean);
  if (!v) throw new Error(`external "${n}" not found in any package.json`);
  dependencies[n] = v;
}
await Bun.write(`${out}/package.json`, JSON.stringify({
  name: appPkg.name,
  version: appPkg.version,
  type: "module",
  main: "src/index.js",
  scripts: { start: "node --env-file=.env src/index.js" },
  dependencies,
}, null, 2));
' "$OUT" "$SRC/package.json" ${PKGS[@]+"${PKGS[@]}"}

cp "$CONFIG" "$OUT/discloud.config"

if [ -z "${DEPLOY_OUT:-}" ]; then
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -a "$OUT"/. .
  OUT=.
fi

echo "Deploy context:"
(cd "$OUT" && find . -path ./.git -prune -o -type f -print | sort)