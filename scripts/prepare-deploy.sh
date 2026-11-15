#!/usr/bin/env bash
# Usage: scripts/prepare-deploy.sh <app> [entry]   (entry default: src/index.ts)
# Needs:    deploy/discloud/<app>.config
# Optional: deploy/discloud/<app>.externals  (packages kept out of the bundle,
#           e.g. native modules; one per line, '#' for comments)
#
# Bundles the app with bun (workspace packages + aliases inlined) into a
# Node-compatible build and places it, with discloud.config, in the output dir.
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

OUT="${DEPLOY_OUT:-$(mktemp -d)}"
rm -rf "$OUT" && mkdir -p "$OUT"

bun install --frozen-lockfile

# Runtime files of the app (assets, json, ...), without sources and secrets
rsync -a --exclude='node_modules' --exclude='.env*' --exclude='Dockerfile' \
  --exclude='package.json' --exclude='tsconfig*.json' --exclude='*.ts' --exclude='*.tsx' \
  "$SRC/" "$OUT/"

bun build "$SRC/$ENTRY" --target=node --outfile="$OUT/$OUT_JS" ${EXT_ARGS[@]+"${EXT_ARGS[@]}"}

# Minimal package.json: ESM + externals (Discloud installs them), versions from the repo
bun -e '
const [out, ...names] = process.argv.slice(1);
const pkgs = [];
for (const g of ["package.json", "apps/*/package.json", "packages/*/package.json"])
  for (const f of new Bun.Glob(g).scanSync(".")) pkgs.push(await Bun.file(f).json());
const dependencies = {};
for (const n of names) {
  const v = pkgs.map((p) => p.dependencies?.[n]).find(Boolean);
  if (!v) throw new Error(`external "${n}" not found in any package.json`);
  dependencies[n] = v;
}
await Bun.write(`${out}/package.json`, JSON.stringify({ type: "module", dependencies }, null, 2));
' "$OUT" ${PKGS[@]+"${PKGS[@]}"}

cp "$CONFIG" "$OUT/discloud.config"

if [ -z "${DEPLOY_OUT:-}" ]; then
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -a "$OUT"/. .
  OUT=.
fi

echo "Deploy context:"
(cd "$OUT" && find . -path ./.git -prune -o -type f -print | sort)