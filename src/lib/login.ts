import { chromium } from 'playwright';
import { DEFAULT_BASE_URL, LOGIN_TIMEOUT_SEC } from './config.js';
import { saveSession, type StoredCookie } from './session-store.js';

function looksLoggedIn(url: string, names: Set<string>): boolean {
  const u = url.toLowerCase();
  if (u.includes('microsoftonline.com') || u.includes('/saml/') || u.includes('/signin')) {
    return false;
  }
  return names.has('_zm_ssid') && names.has('cred') && !u.includes('signin');
}

/** Open a headed browser for Zoom/SSO and save cookies. */
export async function loginInteractive(options?: {
  baseUrl?: string;
  timeoutSec?: number;
  headless?: boolean;
}): Promise<Record<string, unknown>> {
  const baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeoutSec = options?.timeoutSec ?? LOGIN_TIMEOUT_SEC;
  const headless = options?.headless ?? false;
  const startUrl = `${baseUrl}/meeting/schedule`;
  const started = Date.now();

  let browser;
  let channel: string;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    channel = 'chrome';
  } catch {
    browser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    channel = 'chromium';
  }

  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  let lastUrl = page.url();
  const deadline = started + timeoutSec * 1000;
  let success = false;

  while (Date.now() < deadline) {
    const cookies = await context.cookies();
    const names = new Set(cookies.map((c) => c.name));
    lastUrl = page.url();

    if (looksLoggedIn(lastUrl, names)) {
      try {
        await page.goto(`${baseUrl}/meeting/schedule`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        await page.waitForTimeout(1000);
        const cookies2 = await context.cookies();
        const names2 = new Set(cookies2.map((c) => c.name));
        lastUrl = page.url();
        if (looksLoggedIn(lastUrl, names2)) {
          success = true;
          break;
        }
      } catch {
        // keep waiting
      }
    }
    await page.waitForTimeout(1000);
  }

  const finalCookies = await context.cookies();
  await browser.close();

  const names = new Set(finalCookies.map((c) => c.name));
  if (!success || !names.has('_zm_ssid')) {
    return {
      ok: false,
      error: Date.now() >= deadline ? 'timeout' : 'missing_ssid',
      message:
        Date.now() >= deadline
          ? `Login not completed within ${timeoutSec}s. Last URL: ${lastUrl}`
          : 'Login finished but _zm_ssid was not captured.',
      last_url: lastUrl,
      channel,
    };
  }

  const stored: StoredCookie[] = finalCookies
    .filter((c) => c.domain.includes('zoom'))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      secure: c.secure,
      httpOnly: c.httpOnly,
      expires: c.expires > 0 ? c.expires : null,
    }));

  const path = await saveSession({
    cookies: stored,
    baseUrl,
    source: `playwright:${channel}`,
    extra: {
      final_url: lastUrl,
      login_duration_sec: Math.round((Date.now() - started) / 1000),
    },
  });

  return {
    ok: true,
    store_path: path,
    cookie_count: stored.length,
    auth_cookies: [...names].filter((n) =>
      ['_zm_ssid', 'cred', '_zm_page_auth', '_zm_kms'].includes(n),
    ),
    channel,
    final_url: lastUrl,
    base_url: baseUrl,
  };
}
