#!/usr/bin/env bash
(
    cd "$(dirname "$0")/.."
    tsc -b tsconfig.build.json

    targets=("linux-x64-12.14.0 linux-x86-12.14.0 mac-x64-12.14.0 windows-x64-12.14.0 windows-x86-12.14.0"

    for target in $targets; do
        echo "Compiling for target $target"
        nexe \
            --input "./build/src/entry.js" \
            --output "./bin/$target.exe" \
            --resource './node_modules/**/*' \
            --resource './build/**/*' \
            --target "$target"
    done
)
