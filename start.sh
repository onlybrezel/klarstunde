#!/bin/sh
set -eu
cd -P -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 24 fehlt. Bitte von https://nodejs.org installieren.' >&2
  exit 1
fi
exec node scripts/start.mjs "$@"
