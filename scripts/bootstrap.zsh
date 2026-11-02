#!/usr/bin/env zsh

set -euo pipefail

cd "${0:A:h}/.."

missing=()
for tool in brew node pnpm code claude; do
	if ((!$+commands[$tool])); then
		missing+=("$tool")
	fi
done

for tool in clang make git lipo; do
	if ! xcrun --find "$tool" >/dev/null 2>&1; then
		missing+=("$tool")
	fi
done

if ((${#missing} > 0)); then
	print -u2 -r -- "Bump Me needs ${(j:, :)missing}. See Prerequisites in the README."
	exit 1
fi

if ((!$+commands[just])); then
	brew install just
fi
just install
