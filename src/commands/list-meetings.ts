import { Command } from 'commander';
import { DEFAULT_BASE_URL } from '../lib/config.js';
import { errorMessage, fail, printJson } from '../lib/cli.js';
import { createClient } from '../lib/zoom-client.js';

export const listMeetingsCommand = new Command('list-meetings')
  .alias('list')
  .description('List scheduled Zoom meetings')
  .option('--base-url <url>', 'Zoom portal base URL', DEFAULT_BASE_URL)
  .option('--type <type>', 'upcoming or previous', 'upcoming')
  .option('--page <number>', 'Page number', '1')
  .option('--page-size <number>', 'Meetings per page (1-100)', '15')
  .option('--from <YYYY-MM-DD>', 'Start of date range')
  .option('--to <YYYY-MM-DD>', 'End of date range')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    baseUrl: string;
    type: string;
    page: string;
    pageSize: string;
    from?: string;
    to?: string;
    json?: boolean;
  }) => {
    try {
      const client = await createClient({ baseUrl: options.baseUrl });
      const result = await client.listMeetings({
        listType: options.type as 'upcoming' | 'previous',
        page: Number(options.page),
        pageSize: Number(options.pageSize),
        from: options.from,
        to: options.to,
      });
      if (options.json) {
        printJson(result);
        return;
      }

      console.log(`✓ ${result.total_records} ${result.list_type} meeting${result.total_records === 1 ? '' : 's'}`);
      console.log(`  Range: ${result.date_range.from} to ${result.date_range.to}`);
      for (const meeting of result.meetings) {
        console.log(`  ${meeting.start_date ?? ''} ${meeting.start_time ?? ''}  ${meeting.topic ?? '(untitled)'}`.trim());
        console.log(`    ID: ${meeting.meeting_id}`);
      }
    } catch (e) {
      fail(errorMessage(e), options.json);
    }
  });
