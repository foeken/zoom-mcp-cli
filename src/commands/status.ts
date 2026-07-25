import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { describeSession } from '../lib/session-store.js';
import { createClient } from '../lib/zoom-client.js';

export const statusCommand = new Command('status')
  .description('Show session cookie status and live probe')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--json', 'Output as JSON')
  .action(async (options: { baseUrl: string; json?: boolean }) => {
    try {
      const info = await describeSession();
      try {
        const client = await createClient({ baseUrl: options.baseUrl });
        info.live_probe = await client.checkSession();
      } catch (e) {
        info.live_probe = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }

      if (options.json) {
        printJson(info);
        return;
      }

      if (!info.present) {
        console.log('\u2717 No saved session');
        console.log('  Run: zoom login   or   zoom import-chrome');
        return;
      }

      const probe = info.live_probe as { ok?: boolean; error?: string; auth_source?: string } | undefined;
      if (probe?.ok) {
        console.log('\u2713 Session active');
      } else {
        console.log('\u2717 Session not usable');
        if (probe?.error) console.log(`  ${probe.error}`);
      }

      console.log(`  Store:    ${info.store_path}`);
      console.log(`  Source:   ${info.source}`);
      console.log(`  Saved:    ${info.saved_at}`);
      console.log(`  Cookies:  ${info.cookie_count}`);
      console.log(`  _zm_ssid: ${info.has_ssid ? 'yes' : 'no'}`);
      console.log(`  cred:     ${info.has_cred ? 'yes' : 'no'}`);
      if (info.kms_days_remaining != null) {
        console.log(`  _zm_kms:  ~${info.kms_days_remaining}d left`);
      }
      console.log(
        '  Note:    _zm_ssid/cred are session cookies (no fixed TTL); re-login when this fails.',
      );
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
