#!/bin/zsh
set -euo pipefail

export PATH="/Users/andre.foeken/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export ZOOM_MCP_HOST="127.0.0.1"
export ZOOM_MCP_PORT="23383"
export ZOOM_MCP_PUBLIC_URL="https://donut.taila4148b.ts.net/zoom/mcp"
export ZOOM_MCP_BRIDGE_TOKEN="$(security find-generic-password -a andre.foeken -s zoom-mcp-token -w)"

exec /Users/andre.foeken/.bun/bin/bun run /Users/andre.foeken/Code/zoom-mcp-cli/src/cli.ts serve --host "${ZOOM_MCP_HOST}" --port "${ZOOM_MCP_PORT}"
