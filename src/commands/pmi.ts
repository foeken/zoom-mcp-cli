import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const pmiCommand = new Command('pmi')
  .description('Show your personal meeting room (PMI) link')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--json', 'Output as JSON')
  .action(async (options: { baseUrl: string; json?: boolean }) => {
    try {
      const client = await createClient({ baseUrl: options.baseUrl });
      const result = await client.getPersonalMeeting();

      if (options.json) {
        printJson(result);
        return;
      }

      console.log('\u2713 Personal meeting room');
      if (result.pmi) console.log(`  PMI:      ${result.pmi}`);
      if (result.join_url) console.log(`  Join:     ${result.join_url}`);
      if (result.personal_link) console.log(`  Personal: ${result.personal_link}`);
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
