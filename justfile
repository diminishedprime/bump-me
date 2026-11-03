set shell := ["zsh", "-euo", "pipefail", "-c"]
set fallback

default:
    @just --list

# Bundle src into dist/main.js.
build:
    pnpm build

# Typecheck and lint without emitting.
[parallel]
check: typecheck lint format

[private]
typecheck:
    pnpm typecheck

[private]
lint:
    pnpm exec eslint .

[private]
format:
    pnpm exec prettier --check .

fix:
    pnpm exec prettier --write --ignore-unknown .

# Run the test suite.
[parallel]
test: check vitest

[private]
vitest:
    pnpm exec vitest run

# Report code coverage of the test suite.
coverage:
    pnpm exec vitest run --coverage

# Mutation test src against the test suite.
mutation:
    NODE_COMPILE_CACHE=node_modules/.cache/node-compile \
        pnpm exec stryker run stryker.config.mts \
        --concurrency $(node scripts/performance-cores.mts)

# Refresh every captured fixture.
fixtures: hook-fixtures theme-fixtures workspace-id-fixtures

# Compute the workspace ids shasum gives the fixture workspaces.
workspace-id-fixtures:
    #!/usr/bin/env zsh
    set -euo pipefail
    roots=(
        /Users/me/programming/bump-me
        /Users/me/programming/mindful-stage
        /Users/me/programming/dotfiles
        /Users/me/programming/notes
    )
    for root in $roots; do
        print -r -- "$root"$'\t'"${root:t}_$(print -rn -- "$root" | shasum -a 256 | cut -c1-12)"
    done |
        jq -R -n '[inputs | split("\t") | {(.[0]): .[1]}] | add' >test/fixtures/workspace-ids.json
    pnpm exec prettier --write test/fixtures/workspace-ids.json

# Capture real Claude hook payloads into test/fixtures/hooks.
hook-fixtures:
    node scripts/capture-hooks.mts
    pnpm exec prettier --write test/fixtures/hooks

# Fetch VS Code's built-in themes from main into test/fixtures/themes.
theme-fixtures:
    #!/usr/bin/env zsh
    set -euo pipefail
    destination=test/fixtures/themes/theme-defaults
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    vscode=$work/vscode
    git clone --depth 1 --filter=blob:none --sparse --quiet https://github.com/microsoft/vscode.git "$vscode"
    git -C "$vscode" sparse-checkout set extensions/theme-defaults
    if [[ ! -f "$vscode/LICENSE.txt" ]]; then
        print -u2 -r -- "LICENSE.txt is no longer at the root of microsoft/vscode, find where the license lives and update this recipe"
        exit 1
    fi
    rm -rf "$destination"
    cp -R "$vscode/extensions/theme-defaults" "$destination"
    cp "$vscode/LICENSE.txt" "$destination/LICENSE.txt"
    ids=$(jq -c '[.contributes.themes[].id]' "$destination/package.json")
    cat <<-EOF >test/fixtures/themes/built-in-themes.ts
    	export const builtInThemes = $ids as const;
    EOF
    pnpm exec prettier --write "$destination" test/fixtures/themes/built-in-themes.ts

# Build terminal-notifier with the bell icon into ~/Applications/Bump Me.app.
notifier:
    #!/usr/bin/env zsh
    set -euo pipefail
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    iconset=$work/bell.iconset
    mkdir -p "$iconset"
    for size in 16 32 128 256 512; do
        double=$((size * 2))
        sips -s format png -z $size $size assets/bell.svg --out "$iconset/icon_${size}x${size}.png" >/dev/null
        sips -s format png -z $double $double assets/bell.svg --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
    done
    iconutil --convert icns "$iconset" --output "$work/bell.icns"
    git clone --depth 1 --branch 3.1.0 --quiet https://github.com/julienXX/terminal-notifier.git "$work/terminal-notifier"
    make -C "$work/terminal-notifier" icon ICON="$work/bell.icns" APP_NAME=bump-me
    bundle=$work/terminal-notifier/build/bump-me.app
    /usr/libexec/PlistBuddy -c 'Set :CFBundleName Bump Me' "$bundle/Contents/Info.plist"
    codesign --force --sign - "$bundle"
    destination=~/Applications/"Bump Me.app"
    rm -rf "$destination"
    cp -R "$bundle" "$destination"

# Build and install into VS Code and Claude
install: notifier
    pnpm install
    pnpm build
    pnpm package
    code --install-extension bump-me-$(node -p 'require("./package.json").version').vsix
    claude plugin install bump-me --marketplace "$PWD"

# Remove the VS Code extension, Claude plugin, and Bump Me.app
uninstall:
    -code --uninstall-extension diminishedprime.bump-me
    -claude plugin marketplace remove bump-me
    rm -rf ~/Applications/"Bump Me.app" /tmp/bump-me

# Prepare a release
release:
    pnpm exec semantic-release --no-ci
