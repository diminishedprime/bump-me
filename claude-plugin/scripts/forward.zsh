#!/usr/bin/env zsh

set -euo pipefail

root=${CLAUDE_PROJECT_DIR:-$PWD}
# Must match WorkspaceId in the extension (src/workspace-id.ts), or this finds no socket.
id="${root:t}_$(print -rn -- "$root" | shasum -a 256 | cut -c1-12)"
socket="/tmp/bump-me/$id.sock"

if [[ ! -S "$socket" ]]; then
	exit 0
fi

zmodload zsh/net/socket
if ! zsocket "$socket" 2>/dev/null; then
	exit 0
fi
fd=$REPLY
cat >&$fd
exec {fd}>&-
