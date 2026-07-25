# zoom-mcp

CLI and HTTP MCP server for creating, updating, and deleting **Zoom meetings** (join URLs).

Built in the same style as [clippy](../clippy): **TypeScript + Bun + Commander**.

No Zoom Marketplace app. Auth is a **web portal session** stored on device.

## Installation

```bash
git clone https://github.com/<owner>/zoom-mcp-cli.git
cd zoom-mcp-cli
bun install

# Optional: browsers for `zoom login`
bunx playwright install chromium

# Run
bun run src/cli.ts <command>

# Or link globally
bun link
zoom <command>
```

## Authentication

Cookies live in `~/.config/zoom-mcp/cookies.json` (mode `0600`).

```bash
# Interactive browser login (SSO / Microsoft SAML supported)
zoom login

# Or copy cookies from Chrome if already signed in
zoom import-chrome

# Check session + cookie lifetimes
zoom status

# Clear MCP store only
zoom logout
```

### Cookie lifetime

| Cookie | Lifetime | Role |
|--------|----------|------|
| `_zm_ssid`, `cred` | **session** (no Expires) | Main portal auth |
| `_zm_kms` | ~90 days | Longer hint; not enough alone |

API calls are **headless** after login. CSRF is handled automatically via `/csrf_js`.

---

## Meeting commands

Same naming style as clippy (`create-event`, …): kebab-case commands with short aliases.

```bash
# Create
zoom create-meeting "Team Standup" --in 30 --duration 30
zoom create "1:1" --start "2026-07-25 15:00" --duration 45   # alias
zoom create-meeting "Call" --in 15 --json

# Read / update / delete
zoom list-meetings
zoom list-meetings --type previous --page-size 50
zoom get-meeting 12345678901
zoom update-meeting 12345678901 --topic "New title" --duration 60
zoom delete-meeting 12345678901

# Personal room
zoom pmi
zoom pmi --json
```

Human output uses ✓ / Error: like clippy; pass `--json` for scripting.

---

## MCP (HTTP, not stdio)

```bash
zoom serve
# → http://127.0.0.1:8765/mcp
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.zoom]
url = "http://127.0.0.1:8765/mcp"
bearer_token_env_var = "ZOOM_MCP_BRIDGE_TOKEN"
```

The HTTP server always requires a bearer token. Set it through your shell, service manager, or secret manager—never commit its value or a machine-specific launch script:

```bash
export ZOOM_MCP_BRIDGE_TOKEN="replace-with-your-secret"
export ZOOM_MCP_PUBLIC_URL="http://127.0.0.1:8765/mcp"
zoom serve
```

For remote access, keep the server loopback-only and configure your own authenticated reverse proxy. Do not copy another machine's paths, hostname, Keychain references, or service files.

### MCP tools

`login`, `import_chrome_session`, `session_status`, `logout`,  
`list_meetings`, `create_meeting`, `update_meeting`, `delete_meeting`, `get_meeting`, `get_personal_meeting`

---

## Environment

| Variable | Default |
|----------|---------|
| `ZOOM_BASE_URL` | `https://zoom.us` (override for vanity hosts) |
| `ZOOM_TIMEZONE` | `UTC` |
| `ZOOM_MCP_HOST` | `127.0.0.1` |
| `ZOOM_MCP_PORT` | `8765` |
| `ZOOM_MCP_BRIDGE_TOKEN` | required for `zoom serve`; bearer token for `/mcp` |
| `ZOOM_MCP_PUBLIC_URL` | public MCP URL used in bearer metadata |
| `ZOOM_MCP_COOKIE_STORE` | `~/.config/zoom-mcp/cookies.json` |
| `ZOOM_LOGIN_TIMEOUT_SEC` | `300` |

---

## Notes

- Set `ZOOM_BASE_URL` if you use a vanity Zoom host (e.g. `https://company.zoom.us`).
- Portal endpoints are undocumented and may change.
- Personal automation; for production use Server-to-Server OAuth.
