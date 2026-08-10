import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import express from 'express';
import type { Server } from 'node:http';
import { ProblemService } from '../problem/problem.service';
import { mountMcpEndpoint } from './mcp.http';
import { McpService } from './mcp.service';

describe('Remote MCP HTTP endpoint', () => {
  let httpServer: Server;
  let client: Client;
  let transport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    const problem = {
      id: 7,
      slug: 'sample-public',
      title: 'Sample Public Problem',
      difficulty: 'IRON',
      tags: ['sample'],
      score: 10,
      timeLimit: 1000,
      memoryLimit: 256,
      markdown: '# sample-public Sample Public Problem\nPublic statement',
      testcaseCount: 1,
      stats: { totalSubmissions: 0, acceptedSubmissions: 0, acceptanceRate: 0 },
    };
    const problemService = {
      findAll: jest.fn().mockResolvedValue({
        items: [problem],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      findOne: jest.fn().mockResolvedValue(problem),
      getMarkdown: jest.fn().mockResolvedValue(problem.markdown),
    } as unknown as ProblemService;

    const app = express();
    app.use(express.json());
    mountMcpEndpoint(app, new McpService(problemService));
    httpServer = await new Promise<Server>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string')
      throw new Error('HTTP test server did not bind');

    transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
    );
    client = new Client({ name: 'etloj-http-test', version: '1.0.0' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('completes initialize and tools/list over Streamable HTTP', async () => {
    expect(client.getServerVersion()).toEqual(
      expect.objectContaining({ name: 'etloj' }),
    );
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(3);
  });

  it('calls all Phase 1 tools over Streamable HTTP', async () => {
    const search = await client.callTool({
      name: 'search_problems',
      arguments: {},
    });
    const detail = await client.callTool({
      name: 'get_problem',
      arguments: { problem: 'sample-public' },
    });
    const markdown = await client.callTool({
      name: 'get_problem_markdown',
      arguments: { problem: '7' },
    });

    expect(search.isError).not.toBe(true);
    expect(detail.structuredContent).toEqual(
      expect.objectContaining({ slug: 'sample-public' }),
    );
    const firstContent = markdown.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Public statement');
    }
  });
});
