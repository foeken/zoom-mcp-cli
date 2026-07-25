import { Command } from 'commander';
import { DEFAULT_BASE_URL, DEFAULT_TIMEZONE } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const updateMeetingCommand = new Command('update-meeting')
  .alias('update')
  .description('Update an existing Zoom meeting')
  .argument('<meetingId>', 'Numeric Zoom meeting id')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--timezone <tz>', 'Default client timezone', DEFAULT_TIMEZONE)
  .option('--topic <title>', 'New topic')
  .option('--start <datetime>', "New start 'YYYY-MM-DD HH:MM'")
  .option('--duration <minutes>', 'New duration in minutes')
  .option('--meeting-timezone <tz>', 'New meeting timezone')
  .option('--agenda <text>', 'New agenda')
  .option('--json', 'Output as JSON')
  .action(
    async (
      meetingId: string,
      options: {
        baseUrl: string;
        timezone: string;
        topic?: string;
        start?: string;
        duration?: string;
        meetingTimezone?: string;
        agenda?: string;
        json?: boolean;
      },
    ) => {
      try {
        if (
          !options.topic &&
          !options.start &&
          options.duration == null &&
          !options.meetingTimezone &&
          !options.agenda
        ) {
          fail(
            'Provide at least one of: --topic --start --duration --meeting-timezone --agenda',
            options.json,
          );
        }

        const client = await createClient({
          baseUrl: options.baseUrl,
          timezone: options.timezone,
        });
        const result = await client.updateMeeting(meetingId, {
          topic: options.topic,
          start: options.start,
          durationMinutes:
            options.duration != null ? Number(options.duration) : undefined,
          timezone: options.meetingTimezone,
          agenda: options.agenda,
        });

        if (options.json) {
          printJson(result);
          return;
        }

        console.log('\u2713 Meeting updated');
        console.log(`  ID:   ${result.meeting_id}`);
        if (result.join_url) console.log(`  Join: ${result.join_url}`);
      } catch (e) {
        fail(errorMessage(e), options.json);
      }
    },
  );
