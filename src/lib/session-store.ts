import { chmod, mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  /** Unix seconds; omit/null = session cookie */
  expires?: number | null;
}

export interface SessionFile {
  version: number;
  saved_at: string;
  saved_at_unix: number;
  base_url: string;
  source: string;
  cookies: StoredCookie[];
  extra?: Record<string, unknown>;
}

const AUTH_NAMES = new Set([
  '_zm_ssid',
  'cred',
  '_zm_page_auth',
  '_zm_kms',
  'session_tracker',
  'zm_aid',
  'zm_cluster',
  '_zm_cid2',
  '_zm_wc_user',
  '_zm_login_acctype',
  '_zm_multi_ac',
]);

export function cookieStorePath(): string {
  if (process.env.ZOOM_MCP_COOKIE_STORE) {
    return process.env.ZOOM_MCP_COOKIE_STORE;
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, 'zoom-mcp', 'cookies.json');
  return join(homedir(), '.config', 'zoom-mcp', 'cookies.json');
}

export async function loadSession(): Promise<SessionFile | null> {
  try {
    const raw = await readFile(cookieStorePath(), 'utf-8');
    return JSON.parse(raw) as SessionFile;
  } catch {
    return null;
  }
}

export async function saveSession(input: {
  cookies: StoredCookie[];
  baseUrl: string;
  source: string;
  extra?: Record<string, unknown>;
}): Promise<string> {
  const path = cookieStorePath();
  const dir = path.slice(0, path.lastIndexOf('/'));
  await mkdir(dir, { recursive: true });
  const payload: SessionFile = {
    version: 1,
    saved_at: new Date().toISOString(),
    saved_at_unix: Date.now() / 1000,
    base_url: input.baseUrl,
    source: input.source,
    cookies: input.cookies,
    extra: input.extra,
  };
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
  try {
    await chmod(path, 0o600);
  } catch {
    // ignore
  }
  return path;
}

export async function clearSession(): Promise<boolean> {
  try {
    await unlink(cookieStorePath());
    return true;
  } catch {
    return false;
  }
}

export async function describeSession(): Promise<Record<string, unknown>> {
  const path = cookieStorePath();
  const data = await loadSession();
  const now = Date.now() / 1000;

  if (!data) {
    return {
      store_path: path,
      present: false,
      message: 'No saved session. Run: zoom login   or   zoom import-chrome',
    };
  }

  const authCookies = data.cookies
    .filter((c) => AUTH_NAMES.has(c.name))
    .map((c) => {
      if (c.expires == null || c.expires <= 0) {
        return {
          name: c.name,
          domain: c.domain,
          lifetime: 'session',
          expires: null,
          days_remaining: null,
          note: 'No Expires — lives until Zoom invalidates it or you log out.',
        };
      }
      const days = (c.expires - now) / 86400;
      return {
        name: c.name,
        domain: c.domain,
        lifetime: 'persistent',
        expires: new Date(c.expires * 1000).toISOString(),
        days_remaining: Math.round(days * 100) / 100,
        expired: days <= 0,
      };
    });

  const kms = data.cookies.find((c) => c.name === '_zm_kms' && c.expires);
  const ageHours = data.saved_at_unix ? (now - data.saved_at_unix) / 3600 : null;

  return {
    store_path: path,
    present: true,
    source: data.source,
    base_url: data.base_url,
    saved_at: data.saved_at,
    age_hours: ageHours != null ? Math.round(ageHours * 100) / 100 : null,
    cookie_count: data.cookies.length,
    has_ssid: data.cookies.some((c) => c.name === '_zm_ssid' && c.value),
    has_cred: data.cookies.some((c) => c.name === 'cred' && c.value),
    has_kms: Boolean(kms),
    kms_days_remaining:
      kms?.expires != null ? Math.round(((kms.expires - now) / 86400) * 100) / 100 : null,
    auth_cookies: authCookies,
    lifetime_guidance: {
      critical_session_cookies: ['_zm_ssid', 'cred', '_zm_page_auth'],
      observed: {
        _zm_ssid: 'session cookie — primary web login',
        cred: 'session cookie — CSRF companion, rotates often',
        _zm_kms: 'persistent ~90 days when present (not enough alone)',
      },
      practical:
        'Expect hours to many days of API access while Zoom accepts the session. Re-run login when status fails.',
    },
  };
}
