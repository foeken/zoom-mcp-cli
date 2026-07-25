import { DEFAULT_BASE_URL, DEFAULT_TIMEZONE, USER_AGENT } from './config.js';
import { importChromeCookies } from './cookies.js';
import { loadSession, type StoredCookie } from './session-store.js';

export class ZoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZoomError';
  }
}

export interface MeetingResult {
  meeting_id: string;
  join_url: string | null;
  manage_url: string | null;
  master_event_id?: string | null;
  muid?: string | null;
}

type Json = Record<string, unknown>;

function fieldValue(meeting: Json, name: string): unknown {
  const node = meeting[name];
  if (node && typeof node === 'object' && 'value' in (node as Json)) {
    return (node as Json).value;
  }
  return null;
}

function parseStart(options: {
  start?: string;
  minutesFromNow?: number | null;
}): { startDate: string; startTime: string } {
  let dt: Date;
  if (options.start) {
    const cleaned = options.start.trim().replace('T', ' ');
    const iso = cleaned.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );
    const us = cleaned.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (iso) {
      dt = new Date(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3]),
        Number(iso[4]),
        Number(iso[5]),
        iso[6] ? Number(iso[6]) : 0,
      );
    } else if (us) {
      dt = new Date(
        Number(us[3]),
        Number(us[1]) - 1,
        Number(us[2]),
        Number(us[4]),
        Number(us[5]),
        us[6] ? Number(us[6]) : 0,
      );
    } else {
      const parsed = new Date(options.start);
      if (Number.isNaN(parsed.getTime())) {
        throw new ZoomError(
          `Could not parse start=${options.start}. Use YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM.`,
        );
      }
      dt = parsed;
    }
  } else {
    const mins = options.minutesFromNow ?? 60;
    dt = new Date(Date.now() + mins * 60_000);
    dt.setSeconds(0, 0);
    const rem = dt.getMinutes() % 5;
    if (rem) dt = new Date(dt.getTime() + (5 - rem) * 60_000);
  }

  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return {
    startDate: `${mm}/${dd}/${yyyy}`,
    startTime: `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`,
  };
}

export class ZoomClient {
  readonly baseUrl: string;
  readonly timezone: string;
  authSource: string | null = null;
  private cookies: StoredCookie[] = [];

  constructor(options?: { baseUrl?: string; timezone?: string }) {
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timezone = options?.timezone ?? DEFAULT_TIMEZONE;
  }

  async init(): Promise<void> {
    const session = await loadSession();
    if (session?.cookies?.length && session.cookies.some((c) => c.name === '_zm_ssid' && c.value)) {
      this.cookies = session.cookies;
      this.authSource = 'store';
      return;
    }

    const imported = await importChromeCookies(this.baseUrl);
    if (imported.ok) {
      const again = await loadSession();
      if (again?.cookies?.length) {
        this.cookies = again.cookies;
        this.authSource = 'chrome';
        return;
      }
    }

    throw new ZoomError(
      'No Zoom session. Run: zoom login   or   zoom import-chrome',
    );
  }

  private cookieHeader(): string {
    // Prefer last-write for same name; keep host-specific creds by including all
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const c of this.cookies) {
      if (seen.has(c.name) && c.name !== 'cred') continue;
      if (c.name !== 'cred') seen.add(c.name);
      parts.push(`${c.name}=${c.value}`);
    }
    return parts.join('; ');
  }

  private async request(
    method: string,
    path: string,
    options?: {
      body?: string | URLSearchParams | Record<string, string>;
      json?: unknown;
      headers?: Record<string, string>;
      accept?: string;
    },
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: options?.accept ?? 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: this.baseUrl,
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: this.cookieHeader(),
      ...options?.headers,
    };

    let body: string | undefined;
    if (options?.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options?.body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = options.body.toString();
    } else if (typeof options?.body === 'string') {
      body = options.body;
    } else if (options?.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.body).toString();
    }

    const res = await fetch(url, { method, headers, body, redirect: 'follow' });

    // Capture Set-Cookie rotations (cred, etc.) when present
    const setCookie = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
    for (const sc of setCookie) {
      const [pair] = sc.split(';');
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      // Update matching cookie values in memory
      let updated = false;
      for (const c of this.cookies) {
        if (c.name === name) {
          c.value = value;
          updated = true;
        }
      }
      if (!updated) {
        this.cookies.push({ name, value, domain: '.zoom.us', path: '/', secure: true });
      }
    }

    return res;
  }

  private async csrf(): Promise<[string, string]> {
    const res = await this.request('POST', '/csrf_js', {
      headers: { 'FETCH-CSRF-TOKEN': '1' },
      accept: '*/*',
    });
    const text = (await res.text()).trim();
    if (!text.includes(':') || text.startsWith('/**')) {
      throw new ZoomError(`Unexpected CSRF response: ${text.slice(0, 120)}`);
    }
    const idx = text.indexOf(':');
    return [text.slice(0, idx), text.slice(idx + 1)];
  }

  private async warm(): Promise<void> {
    const res = await this.request('GET', '/meeting/schedule', {
      accept: 'text/html',
      headers: { Referer: this.baseUrl },
    });
    if (res.url.toLowerCase().includes('signin')) {
      throw new ZoomError(
        `Not logged in (redirected to sign-in). Run: zoom login\nURL: ${res.url}`,
      );
    }
  }

  private assertOk(data: Json, action: string): Json {
    if (!data.status) {
      throw new ZoomError(
        `${action} failed: errorCode=${String(data.errorCode)} message=${String(data.errorMessage)}`,
      );
    }
    return data;
  }

  private parseSave(data: Json): MeetingResult {
    const result = (data.result ?? {}) as Json;
    const meetingId = String(result.mn ?? result.oldResult ?? '');
    if (!meetingId) throw new ZoomError(`Save succeeded but no meeting id: ${JSON.stringify(result)}`);
    let manage = result.url as string | undefined;
    if (manage?.startsWith('/')) manage = `${this.baseUrl}${manage}`;
    return {
      meeting_id: meetingId,
      join_url: typeof result.joinLink === 'string' ? result.joinLink : null,
      manage_url: typeof manage === 'string' ? manage : null,
      master_event_id: typeof result.mmeid === 'string' ? result.mmeid : null,
      muid: typeof result.muid === 'string' ? result.muid : null,
    };
  }

  async checkSession(): Promise<Record<string, unknown>> {
    try {
      const res = await this.request('GET', '/meeting/schedule', {
        accept: 'text/html',
        headers: { Referer: this.baseUrl },
      });
      const loggedIn = !res.url.toLowerCase().includes('signin') && res.status === 200;
      return {
        ok: loggedIn,
        auth_source: this.authSource,
        final_url: res.url,
        status_code: res.status,
      };
    } catch (e) {
      return {
        ok: false,
        auth_source: this.authSource,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async createMeeting(input: {
    topic?: string;
    start?: string;
    minutesFromNow?: number | null;
    durationMinutes?: number;
    timezone?: string;
    agenda?: string;
  }): Promise<MeetingResult> {
    await this.warm();
    const [tokenName, tokenValue] = await this.csrf();
    const { startDate, startTime } = parseStart({
      start: input.start,
      minutesFromNow: input.start ? null : (input.minutesFromNow ?? 60),
    });
    const body: Json = {
      topic: { value: input.topic ?? 'Meeting' },
      timezone: { value: input.timezone ?? this.timezone },
      startDate: { value: startDate },
      startTime: { value: startTime },
      duration: { value: input.durationMinutes ?? 30 },
      frontParam: { groupId: '', targetUserId: null },
    };
    if (input.agenda != null) body.agenda = { value: input.agenda };

    const res = await this.request('POST', '/rest/meeting/save', {
      json: body,
      headers: {
        Referer: `${this.baseUrl}/meeting/schedule`,
        [tokenName]: tokenValue,
      },
    });
    const data = this.assertOk((await res.json()) as Json, 'create_meeting');
    return this.parseSave(data);
  }

  async getMeeting(meetingId: string): Promise<Record<string, unknown>> {
    await this.warm();
    const res = await this.request(
      'GET',
      `/rest/meeting/schedule?meetingNumber=${encodeURIComponent(meetingId)}`,
      { headers: { Referer: `${this.baseUrl}/meeting/${meetingId}/edit` } },
    );
    const data = this.assertOk((await res.json()) as Json, 'get_meeting');
    const result = (data.result ?? {}) as Json;
    const meeting = result.meeting as Json | undefined;
    if (!meeting) throw new ZoomError(`Meeting ${meetingId} not found.`);

    let joinUrl: string | null = `${this.baseUrl}/j/${meetingId}`;
    try {
      const page = await this.request('GET', `/meeting/${meetingId}`, {
        accept: 'text/html',
        headers: { Referer: `${this.baseUrl}/meeting` },
      });
      const html = await page.text();
      const m = html.match(
        new RegExp(`https://[^"'\\s<>]+zoom\\.us/j/${meetingId}\\?pwd=[^"'\\s<>]+`),
      );
      if (m) joinUrl = m[0];
    } catch {
      // keep bare link
    }

    return {
      meeting_id: meetingId,
      topic: fieldValue(meeting, 'topic'),
      agenda: fieldValue(meeting, 'agenda'),
      start_date: fieldValue(meeting, 'startDate'),
      start_time: fieldValue(meeting, 'startTime'),
      duration_minutes: fieldValue(meeting, 'duration'),
      timezone: fieldValue(meeting, 'timezone'),
      join_url: joinUrl,
      manage_url: `${this.baseUrl}/meeting/${meetingId}`,
    };
  }

  async updateMeeting(
    meetingId: string,
    input: {
      topic?: string;
      start?: string;
      durationMinutes?: number;
      timezone?: string;
      agenda?: string;
    },
  ): Promise<MeetingResult> {
    await this.warm();
    const load = await this.request(
      'GET',
      `/rest/meeting/schedule?meetingNumber=${encodeURIComponent(meetingId)}`,
      { headers: { Referer: `${this.baseUrl}/meeting/${meetingId}/edit` } },
    );
    const loaded = this.assertOk((await load.json()) as Json, 'load meeting for update');
    const result = (loaded.result ?? {}) as Json;
    const meeting = result.meeting as Json | undefined;
    if (!meeting) throw new ZoomError(`Cannot load meeting ${meetingId} for update.`);

    const setVal = (key: string, value: unknown) => {
      const node = meeting[key];
      if (node && typeof node === 'object') {
        (node as Json).value = value;
      }
    };

    if (input.topic != null) setVal('topic', input.topic);
    if (input.agenda != null) setVal('agenda', input.agenda);
    if (input.durationMinutes != null) setVal('duration', input.durationMinutes);
    if (input.timezone != null) setVal('timezone', input.timezone);
    if (input.start != null) {
      const { startDate, startTime } = parseStart({ start: input.start, minutesFromNow: null });
      setVal('startDate', startDate);
      setVal('startTime', startTime);
    }

    meeting.frontParam = {
      groupId: '',
      targetUserId: null,
      responseToSingleOccurrence: false,
      occurrence: 0,
      sendEmailToRegistrants: false,
    };

    const [tokenName, tokenValue] = await this.csrf();
    const res = await this.request(
      'POST',
      `/rest/meeting/save?meetingNumber=${encodeURIComponent(meetingId)}`,
      {
        json: meeting,
        headers: {
          Referer: `${this.baseUrl}/meeting/${meetingId}/edit`,
          [tokenName]: tokenValue,
        },
      },
    );
    const data = this.assertOk((await res.json()) as Json, 'update_meeting');
    return this.parseSave(data);
  }

  async deleteMeeting(meetingId: string): Promise<{ meeting_id: string; deleted: boolean }> {
    await this.warm();
    const [tokenName, tokenValue] = await this.csrf();
    const res = await this.request('POST', '/meeting/delete', {
      body: { id: String(meetingId) },
      headers: {
        Referer: `${this.baseUrl}/meeting/${meetingId}`,
        [tokenName]: tokenValue,
      },
    });
    const data = this.assertOk((await res.json()) as Json, 'delete_meeting');
    return { meeting_id: String(meetingId), deleted: Boolean(data.result) };
  }

  async getPersonalMeeting(): Promise<Record<string, unknown>> {
    await this.warm();
    const res = await this.request('GET', '/profile', {
      accept: 'text/html',
      headers: { Referer: this.baseUrl },
    });
    const html = await res.text();
    const join = html.match(/https:\/\/[^"'\s]+zoom\.us\/j\/\d+\?pwd=[^"'\s]+/);
    const personal = html.match(/https:\/\/[^"'\s]+zoom\.us\/my\/[A-Za-z0-9._-]+/);
    let pmi: string | null = null;
    const pmiMatch = html.match(/pmi["\s:]+["']?(\d{9,12})/i) || html.match(/\/pmi\/(\d{9,12})/);
    if (pmiMatch) pmi = pmiMatch[1];
    else if (join) {
      const m = join[0].match(/\/j\/(\d{9,12})/);
      if (m) pmi = m[1];
    }
    return {
      pmi,
      join_url: join?.[0] ?? null,
      personal_link: personal?.[0] ?? null,
      base_url: this.baseUrl,
    };
  }
}

export async function createClient(options?: {
  baseUrl?: string;
  timezone?: string;
}): Promise<ZoomClient> {
  const client = new ZoomClient(options);
  await client.init();
  return client;
}
