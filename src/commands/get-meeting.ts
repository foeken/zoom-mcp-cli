import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const getMeetingCommand = new Command('get-meeting')
  .alias('get')
  .description('Get Zoom meeting details')
  .argument('<meetingId>', 'Numeric Zoom meeting id')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--json', 'Output as JSON')
  .action(async (meetingId: string, options: { baseUrl: string; json?: boolean }) => {
    try {
      const client = await createClient({ baseUrl: options.baseUrl });
      const result = await client.getMeeting(meetingId);

      if (options.json) {
        printJson(result);
        return;
      }

      console.log('\u2713 Meeting');
      console.log(`  ID:       ${result.meeting_id}`);
      if (result.topic) console.log(`  Topic:    ${result.topic}`);
      if (result.start_date || result.start_time) {
        console.log(
          `  When:     ${result.start_date ?? ''} ${result.start_time ?? ''}`.trim(),
        );
      }
      if (result.duration_minutes != null) {
        console.log(`  Duration: ${result.duration_minutes} min`);
      }
      if (result.timezone) console.log(`  Timezone: ${result.timezone}`);
      if (result.join_url) console.log(`  Join:     ${result.join_url}`);
      if (result.manage_url) console.log(`  Manage:   ${result.manage_url}`);
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
