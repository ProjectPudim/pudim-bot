#!/usr/bin/env bash
# Usage: scripts/prepare-deploy.sh <app>
# Needs: apps/<app>/Dockerfile and deploy/discloud/<app>.config
#
# Builds a pruned Docker build context (monorepo layout kept) with
# Dockerfile and discloud.config at its root, ready for Discloud.
#   default          -> replaces the workspace with the context (CI only!)
#   DEPLOY_OUT=<dir> -> writes the context to <dir>, deletes nothing
set -euo pipefail

APP="${1:?usage: prepare-deploy.sh <app>}"
SRC="apps/$APP"
CONFIG="deploy/discloud/$APP.config"

for f in "$SRC/Dockerfile" "$CONFIG" bun.lock; do
  [ -f "$f" ] || { echo "Error: $f not found"; exit 1; }
done

OUT="${DEPLOY_OUT:-$(mktemp -d)}"
rm -rf "$OUT" && mkdir -p "$OUT"

# Monorepo root files + packages/ (without apps, tooling and secrets)
rsync -a \
  --exclude='/apps/' --exclude='/scripts/' --exclude='/deploy/' \
  --exclude='/.git*' --exclude='/.vscode/' --exclude='/.deploy-out/' \
  --exclude='/.prettier*' --exclude='/eslint.config.*' --exclude='/prettier.config.*' \
  --exclude='/LICENSE' --exclude='/README.md' \
  --exclude='node_modules' --exclude='.env*' \
  ./ "$OUT/"

# Target app, complete (source + assets)
mkdir -p "$OUT/$SRC"
rsync -a --exclude='node_modules' --exclude='.env*' --exclude='/Dockerfile' \
  "$SRC/" "$OUT/$SRC/"

# Other apps: manifest only, so --frozen-lockfile still matches
for p in apps/*/package.json; do
  d="$(dirname "$p")"
  [ "$d" = "$SRC" ] || { mkdir -p "$OUT/$d"; cp "$p" "$OUT/$d/"; }
done

cp "$SRC/Dockerfile" "$OUT/Dockerfile"
cp "$CONFIG" "$OUT/discloud.config"

if [ -z "${DEPLOY_OUT:-}" ]; then
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -a "$OUT"/. .
  OUT=.
fi

echo "Deploy context:"
(cd "$OUT" && find . -path ./.git -prune -o -type f -print | sort)