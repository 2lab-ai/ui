#!/usr/bin/env bash
# Pack the library, install the tarball into a throwaway consumer, typecheck it under NodeNext.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
npm pack --silent --pack-destination "$work" >/dev/null
cp "$here/scripts/consumer/check.ts" "$here/scripts/consumer/tsconfig.json" "$work/"
cd "$work"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
npm i --no-audit --no-fund --loglevel=error ./2lab-ai-ui-*.tgz "typescript@$(node -p "require('$here/node_modules/typescript/package.json').version")" >/dev/null
npx tsc -p .
echo "consumer-check: packed tarball typechecks under NodeNext"
