import { Command } from 'commander';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { clearSession, cookieStorePath } from '../lib/session-store.js';

export const logoutCommand = new Command('logout')
  .description('Clear the local MCP/CLI cookie store')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const cleared = await clearSession();
      const payload = { ok: true, cleared, store_path: cookieStorePath() };
      if (options.json) {
        printJson(payload);
        return;
      }
      if (cleared) {
        console.log('\u2713 Cleared local session store');
        console.log(`  ${cookieStorePath()}`);
      } else {
        console.log('No local session store to clear');
        console.log(`  ${cookieStorePath()}`);
      }
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
