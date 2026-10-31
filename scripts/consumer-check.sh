#!/usr/bin/env bash
# Pack the library, install the tarball into a throwaway consumer, typecheck it under NodeNext and register every element.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
npm pack --silent --pack-destination "$work" >/dev/null
cp "$here/scripts/consumer/check.ts" "$here/scripts/consumer/tsconfig.json" "$here/scripts/consumer/register.mjs" \
  "$here/scripts/consumer/node10.ts" "$here/scripts/consumer/tsconfig.node10.json" "$here/scripts/consumer/smoke.cjs" "$work/"
cd "$work"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
npm i --no-audit --no-fund --loglevel=error ./*.tgz "typescript@$(node -p "require('$here/node_modules/typescript/package.json').version")" \
  "happy-dom@$(node -p "require('$here/node_modules/happy-dom/package.json').version")" >/dev/null
npx tsc -p .
echo "consumer-check: packed tarball typechecks under NodeNext (root + $(node -p "Object.keys(require('$here/package.json').exports).filter((k) => k !== '.' && !/\\.(css|json)$/.test(k)).length") subpaths)"
# A CommonJS TypeScript server (moduleResolution node10): the root through "types", ./server through typesVersions.
npx tsc -p tsconfig.node10.json
echo "consumer-check: node10 resolution typechecks the root and @2lab.ai/ui/server (typesVersions)"
node register.mjs
# CommonJS runtime, no DOM: require('@2lab.ai/ui/server') takes the require condition (dist/server.cjs).
node smoke.cjs
