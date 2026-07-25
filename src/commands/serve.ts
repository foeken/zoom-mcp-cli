import { Command } from 'commander';
import { DEFAULT_MCP_HOST, DEFAULT_MCP_PORT } from '../lib/config.js';
import { startHttpServer } from '../lib/mcp-server.js';

export const serveCommand = new Command('serve')
  .description('Run MCP server over HTTP (streamable-http, not stdio)')
  .option('--host <host>', 'Bind host', DEFAULT_MCP_HOST)
  .option('--port <port>', 'Bind port', String(DEFAULT_MCP_PORT))
  .action(async (options: { host: string; port: string }) => {
    await startHttpServer({
      host: options.host,
      port: Number(options.port),
    });
    // keep process alive
    await new Promise(() => {});
  });
