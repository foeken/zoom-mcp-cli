import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { importChromeCookies } from '../lib/cookies.js';

export const importChromeCommand = new Command('import-chrome')
  .description('Import Zoom cookies from Google Chrome into the local store')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--json', 'Output as JSON')
  .action(async (options: { baseUrl: string; json?: boolean }) => {
    try {
      const result = await importChromeCookies(options.baseUrl);

      if (options.json) {
        printJson(result);
      } else if (result.ok) {
        console.log('\u2713 Imported Chrome session');
        console.log(`  Store:   ${result.store_path}`);
        console.log(`  Cookies: ${result.cookie_count}`);
      } else {
        fail(result.message ?? result.error ?? 'Import failed', options.json);
      }

      if (!result.ok) process.exit(1);
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
