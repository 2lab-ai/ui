#!/usr/bin/env bash
# Install @2lab.ai/ui@<version> from the public npm registry into a throwaway consumer; typecheck (NodeNext) and run it.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
version="${1:-$(node -p "require('$here/package.json').version")}"
work="$(mktemp -d)"
cp "$here/scripts/consumer/check.ts" "$here/scripts/consumer/tsconfig.json" "$here/scripts/consumer/register.mjs" "$work/"
cd "$work"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
printf 'registry=https://registry.npmjs.org/\n' > .npmrc
# A just-published version can take minutes to reach the registry CDN: retry for ~10 min, never from npm's cache.
for i in $(seq 1 20); do
  npm i --prefer-online --no-audit --no-fund --loglevel=error "@2lab.ai/ui@$version" happy-dom@20 typescript@5.9 && break
  [ "$i" = 20 ] && { echo "registry-check: install failed"; exit 1; }
  sleep 30
done
echo "registry-check: installed $(node -p "require('@2lab.ai/ui/package.json').name + '@' + require('@2lab.ai/ui/package.json').version") from $(npm config get registry)"
npm ls @2lab.ai/ui
npx tsc -p .
echo "registry-check: NodeNext typecheck ok (root + 7 subpaths)"
node register.mjs
