import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const deleteMeetingCommand = new Command('delete-meeting')
  .alias('delete')
  .description('Delete a Zoom meeting by id')
  .argument('<meetingId>', 'Numeric Zoom meeting id')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--json', 'Output as JSON')
  .action(async (meetingId: string, options: { baseUrl: string; json?: boolean }) => {
    try {
      const client = await createClient({ baseUrl: options.baseUrl });
      const result = await client.deleteMeeting(meetingId);

      if (options.json) {
        printJson(result);
        return;
      }

      if (result.deleted) {
        console.log('\u2713 Meeting deleted');
        console.log(`  ID: ${result.meeting_id}`);
      } else {
        fail(`Delete did not confirm for meeting ${meetingId}`, options.json);
      }
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
