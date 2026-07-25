export const DEFAULT_BASE_URL = (process.env.ZOOM_BASE_URL ?? 'https://zoom.us').replace(/\/$/, '');
export const DEFAULT_TIMEZONE = process.env.ZOOM_TIMEZONE ?? 'UTC';
export const DEFAULT_MCP_HOST = process.env.ZOOM_MCP_HOST ?? '127.0.0.1';
export const DEFAULT_MCP_PORT = Number(process.env.ZOOM_MCP_PORT ?? '8765');
export const LOGIN_TIMEOUT_SEC = Number(process.env.ZOOM_LOGIN_TIMEOUT_SEC ?? '300');

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
