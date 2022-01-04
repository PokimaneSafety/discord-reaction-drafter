#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

(
    cd "$(dirname "$0")/.."
    ./node_modules/.bin/lint-staged -c .lint-stagedrc.js
)
