#!/usr/bin/env bun
import { Command } from 'commander';
import { createMeetingCommand } from './commands/create-meeting.js';
import { deleteMeetingCommand } from './commands/delete-meeting.js';
import { getMeetingCommand } from './commands/get-meeting.js';
import { importChromeCommand } from './commands/import-chrome.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { pmiCommand } from './commands/pmi.js';
import { serveCommand } from './commands/serve.js';
import { statusCommand } from './commands/status.js';
import { updateMeetingCommand } from './commands/update-meeting.js';

const program = new Command();

program
  .name('zoom')
  .description('CLI for Zoom meetings')
  .version('0.2.0');

// Auth / session
program.addCommand(loginCommand);
program.addCommand(importChromeCommand);
program.addCommand(statusCommand);
program.addCommand(logoutCommand);

// Meetings (clippy-style kebab names + short aliases)
program.addCommand(createMeetingCommand);
program.addCommand(getMeetingCommand);
program.addCommand(updateMeetingCommand);
program.addCommand(deleteMeetingCommand);
program.addCommand(pmiCommand);

// MCP HTTP server (optional)
program.addCommand(serveCommand);

program.parse();
