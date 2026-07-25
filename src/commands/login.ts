import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { loginInteractive } from '../lib/login.js';

export const loginCommand = new Command('login')
  .description('Open browser, complete Zoom/SSO, save cookies')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--timeout <seconds>', 'Login wait timeout', '300')
  .option('--headless', 'Headless browser (only if already authenticated)')
  .option('--json', 'Output as JSON')
  .action(
    async (options: {
      baseUrl: string;
      timeout: string;
      headless?: boolean;
      json?: boolean;
    }) => {
      try {
        const result = await loginInteractive({
          baseUrl: options.baseUrl,
          timeoutSec: Number(options.timeout),
          headless: Boolean(options.headless),
        });

        if (options.json) {
          printJson(result);
        } else if (result.ok) {
          console.log('\u2713 Logged in');
          console.log(`  Store:   ${result.store_path}`);
          console.log(`  Cookies: ${result.cookie_count}`);
          console.log(`  Browser: ${result.channel}`);
        } else {
          fail(String(result.message ?? result.error ?? 'Login failed'), options.json);
        }

        if (!result.ok) process.exit(1);
      } catch (e) {
        fail(errorMessage(e), options.json);
      }
    },
  );
