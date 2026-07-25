import { getCookies } from '@steipete/sweet-cookie';
import { DEFAULT_BASE_URL } from './config.js';
import { saveSession, type StoredCookie } from './session-store.js';

/** Import Zoom cookies from local Google Chrome into the MCP store. */
export async function importChromeCookies(baseUrl = DEFAULT_BASE_URL): Promise<{
  ok: boolean;
  store_path?: string;
  cookie_count?: number;
  error?: string;
  message?: string;
  warnings?: string[];
}> {
  const { cookies, warnings } = await getCookies({
    url: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    browsers: ['chrome'],
  });

  // Also pull bare zoom.us domain cookies if vanity host was used
  const { cookies: zoomUsCookies, warnings: w2 } = await getCookies({
    url: 'https://zoom.us/',
    browsers: ['chrome'],
  });

  const byKey = new Map<string, StoredCookie>();
  for (const c of [...cookies, ...zoomUsCookies]) {
    const domain = c.domain || '.zoom.us';
    const key = `${domain}|${c.name}|${c.path || '/'}`;
    // sweet-cookie expires is unix seconds when present
    const rawExp = c.expires as number | Date | undefined;
    const exp =
      typeof rawExp === 'number' && rawExp > 0
        ? rawExp
        : rawExp instanceof Date
          ? Math.floor(rawExp.getTime() / 1000)
          : null;
    byKey.set(key, {
      name: c.name,
      value: c.value,
      domain,
      path: c.path || '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      expires: exp,
    });
  }

  const stored = [...byKey.values()];
  if (!stored.some((c) => c.name === '_zm_ssid' && c.value)) {
    return {
      ok: false,
      error: 'missing_ssid',
      message: 'Chrome has no _zm_ssid cookie. Sign in to Zoom in Chrome, then retry.',
      warnings: [...(warnings ?? []), ...(w2 ?? [])].map(String),
    };
  }

  const path = await saveSession({
    cookies: stored,
    baseUrl,
    source: 'chrome_import',
  });

  return {
    ok: true,
    store_path: path,
    cookie_count: stored.length,
    warnings: [...(warnings ?? []), ...(w2 ?? [])].map(String),
  };
}
