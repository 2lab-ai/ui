#!/usr/bin/env bash
# Install @2lab-ai/ui@<version> from GitHub Packages into a throwaway consumer; typecheck (NodeNext) and run it.
# Needs NODE_AUTH_TOKEN with read access to the package (in Actions: GITHUB_TOKEN of this repo).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
version="${1:-$(node -p "require('$here/package.json').version")}"
work="$(mktemp -d)"
cp "$here/scripts/consumer/check.ts" "$here/scripts/consumer/tsconfig.json" "$here/scripts/consumer/register.mjs" "$work/"
cd "$work"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
printf '@2lab-ai:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n' > .npmrc
for i in 1 2 3 4 5 6; do
  npm i --no-audit --no-fund --loglevel=error "@2lab-ai/ui@$version" happy-dom@20 typescript@5.9 && break
  [ "$i" = 6 ] && { echo "registry-check: install failed"; exit 1; }
  sleep 20
done
echo "registry-check: installed $(node -p "require('@2lab-ai/ui/package.json').name + '@' + require('@2lab-ai/ui/package.json').version") from $(npm config get @2lab-ai:registry)"
npm ls @2lab-ai/ui
npx tsc -p .
echo "registry-check: NodeNext typecheck ok (root + 7 subpaths)"
node register.mjs
