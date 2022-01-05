#!/usr/bin/env bash
(
    cd "$(dirname "$0")/.."
    tsc -b tsconfig.build.json

    targets="linux-x64-14.15.3 linux-x86-14.15.3 mac-x64-14.15.3 windows-x64-14.15.3 windows-x86-14.15.3"

    for target in $targets; do
        echo "Compiling for target $target"
        nexe \
            --input "./build/src/entry.js" \
            --output "./bin/$target" \
            --resource './node_modules/discord.js/**/*' \
            --resource './build/**/*' \
            --target "$target"
    done
)
