#!/usr/bin/env bash
# Pack the library, install the tarball into a throwaway consumer, typecheck it under NodeNext and register every element.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
npm pack --silent --pack-destination "$work" >/dev/null
cp "$here/scripts/consumer/check.ts" "$here/scripts/consumer/tsconfig.json" "$here/scripts/consumer/register.mjs" "$work/"
cd "$work"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
npm i --no-audit --no-fund --loglevel=error ./*.tgz "typescript@$(node -p "require('$here/node_modules/typescript/package.json').version")" \
  "happy-dom@$(node -p "require('$here/node_modules/happy-dom/package.json').version")" >/dev/null
npx tsc -p .
echo "consumer-check: packed tarball typechecks under NodeNext (root + 13 subpaths)"
node register.mjs
