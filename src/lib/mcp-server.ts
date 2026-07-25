import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod/v4';
import { DEFAULT_BASE_URL, DEFAULT_MCP_HOST, DEFAULT_MCP_PORT } from './config.js';
import { importChromeCookies } from './cookies.js';
import { loginInteractive } from './login.js';
import { clearSession, describeSession } from './session-store.js';
import { createClient, ZoomError } from './zoom-client.js';

function textResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(error: unknown) {
  return textResult({
    error: error instanceof Error ? error.message : String(error),
    type: error instanceof Error ? error.name : 'Error',
  });
}

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'zoom-mcp',
    version: '0.2.0',
  });

  server.registerTool(
    'login',
    {
      title: 'Login to Zoom',
      description:
        'Open a local browser for Zoom/SSO login and save session cookies for later tools.',
      inputSchema: {
        timeout_sec: z.number().int().min(30).max(900).default(300),
      },
    },
    async ({ timeout_sec }) => {
      try {
        return textResult(
          await loginInteractive({ baseUrl: DEFAULT_BASE_URL, timeoutSec: timeout_sec }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'import_chrome_session',
    {
      title: 'Import Chrome Zoom cookies',
      description: 'Copy Zoom cookies from Google Chrome into the MCP cookie store.',
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await importChromeCookies(DEFAULT_BASE_URL));
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'session_status',
    {
      title: 'Session status',
      description: 'Report cookie lifetimes and whether the Zoom session currently works.',
      inputSchema: {},
    },
    async () => {
      try {
        const info = await describeSession();
        try {
          const client = await createClient();
          info.live_probe = await client.checkSession();
        } catch (e) {
          info.live_probe = {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
        return textResult(info);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'logout',
    {
      title: 'Logout MCP session',
      description: 'Delete the saved MCP Zoom cookie store (does not sign out Chrome).',
      inputSchema: {},
    },
    async () => {
      try {
        const cleared = await clearSession();
        return textResult({ ok: true, cleared });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'create_meeting',
    {
      title: 'Create Zoom meeting',
      description: 'Create a Zoom meeting and return join_url.',
      inputSchema: {
        topic: z.string().default('Meeting'),
        start: z
          .string()
          .optional()
          .describe("Optional start as 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DDTHH:MM'"),
        minutes_from_now: z.number().int().default(60),
        duration_minutes: z.number().int().default(30),
        timezone: z.string().optional(),
        agenda: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const client = await createClient();
        const result = await client.createMeeting({
          topic: args.topic,
          start: args.start,
          minutesFromNow: args.start ? null : args.minutes_from_now,
          durationMinutes: args.duration_minutes,
          timezone: args.timezone,
          agenda: args.agenda,
        });
        return textResult({ ok: true, action: 'create', ...result });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'update_meeting',
    {
      title: 'Update Zoom meeting',
      description: 'Update topic/start/duration/timezone/agenda for an existing meeting.',
      inputSchema: {
        meeting_id: z.string().min(1),
        topic: z.string().optional(),
        start: z.string().optional(),
        duration_minutes: z.number().int().optional(),
        timezone: z.string().optional(),
        agenda: z.string().optional(),
      },
    },
    async (args) => {
      try {
        if (
          args.topic == null &&
          args.start == null &&
          args.duration_minutes == null &&
          args.timezone == null &&
          args.agenda == null
        ) {
          throw new ZoomError('Provide at least one field to update.');
        }
        const client = await createClient();
        const result = await client.updateMeeting(args.meeting_id, {
          topic: args.topic,
          start: args.start,
          durationMinutes: args.duration_minutes,
          timezone: args.timezone,
          agenda: args.agenda,
        });
        return textResult({ ok: true, action: 'update', ...result });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'delete_meeting',
    {
      title: 'Delete Zoom meeting',
      description: 'Delete a Zoom meeting by numeric meeting id.',
      inputSchema: {
        meeting_id: z.string().min(1),
      },
    },
    async ({ meeting_id }) => {
      try {
        const client = await createClient();
        const result = await client.deleteMeeting(meeting_id);
        return textResult({ ok: true, action: 'delete', ...result });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'get_meeting',
    {
      title: 'Get Zoom meeting',
      description: 'Get meeting details and join URL when available.',
      inputSchema: {
        meeting_id: z.string().min(1),
      },
    },
    async ({ meeting_id }) => {
      try {
        const client = await createClient();
        const result = await client.getMeeting(meeting_id);
        return textResult({ ok: true, action: 'get', ...result });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'get_personal_meeting',
    {
      title: 'Get PMI',
      description: 'Return personal meeting room join URL / PMI.',
      inputSchema: {},
    },
    async () => {
      try {
        const client = await createClient();
        const result = await client.getPersonalMeeting();
        return textResult({ ok: true, action: 'personal', ...result });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  return server;
}

/** Start stateless streamable HTTP MCP on host:port/mcp */
export async function startHttpServer(options?: {
  host?: string;
  port?: number;
}): Promise<void> {
  const host = options?.host ?? DEFAULT_MCP_HOST;
  const port = options?.port ?? DEFAULT_MCP_PORT;
  const app = createMcpExpressApp();

  app.post('/mcp', async (req, res) => {
    const server = buildServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    });
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    });
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, host, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  console.error(`zoom-mcp HTTP listening on http://${host}:${port}/mcp`);
  console.error(`Codex: url = "http://${host}:${port}/mcp"`);
}
