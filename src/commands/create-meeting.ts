import { Command } from 'commander';
import { DEFAULT_BASE_URL, DEFAULT_TIMEZONE } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const createMeetingCommand = new Command('create-meeting')
  .alias('create')
  .description('Create a Zoom meeting and print the join URL')
  .argument('[topic]', 'Meeting topic', 'Meeting')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--timezone <tz>', 'Timezone', DEFAULT_TIMEZONE)
  .option('--start <datetime>', "Start as 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DDTHH:MM'")
  .option('--in <minutes>', 'Start in N minutes (ignored if --start is set)', '60')
  .option('--duration <minutes>', 'Duration in minutes', '30')
  .option('--agenda <text>', 'Agenda / description')
  .option('--json', 'Output as JSON')
  .action(
    async (
      topic: string,
      options: {
        baseUrl: string;
        timezone: string;
        start?: string;
        in: string;
        duration: string;
        agenda?: string;
        json?: boolean;
      },
    ) => {
      try {
        const client = await createClient({
          baseUrl: options.baseUrl,
          timezone: options.timezone,
        });
        const result = await client.createMeeting({
          topic,
          start: options.start,
          minutesFromNow: options.start ? null : Number(options.in),
          durationMinutes: Number(options.duration),
          timezone: options.timezone,
          agenda: options.agenda,
        });

        if (options.json) {
          printJson(result);
          return;
        }

        console.log('\u2713 Meeting created');
        console.log(`  Topic:  ${topic}`);
        console.log(`  ID:     ${result.meeting_id}`);
        if (result.join_url) console.log(`  Join:   ${result.join_url}`);
        if (result.manage_url) console.log(`  Manage: ${result.manage_url}`);
      } catch (e) {
        fail(errorMessage(e), options.json);
      }
    },
  );
