import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import express from 'express';
import type { Server } from 'node:http';
import { ProblemService } from '../problem/problem.service';
import { ProblemListService } from '../problem-list/problem-list.service';
import { SubmissionService } from '../submission/submission.service';
import { TagService } from '../tag/tag.service';
import { mountMcpEndpoint } from './mcp.http';
import { McpService } from './mcp.service';
import { McpOAuthService } from './auth/mcp-oauth.service';
import type { AuthInfo, OAuthMetadata } from '@modelcontextprotocol/server';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

describe('Remote MCP HTTP endpoint', () => {
  let httpServer: Server;
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  let baseUrl: string;
  let submissionService: jest.Mocked<
    Pick<
      SubmissionService,
      | 'getMyPublicProblemStatus'
      | 'listMyPublicSubmissions'
      | 'getMyPublicSubmission'
    >
  >;

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
    const tagService = {
      findPublicTags: jest
        .fn()
        .mockResolvedValue([{ name: 'sample', problemCount: 1 }]),
    } as unknown as TagService;
    const problemListService = {
      findAllPublicForMcp: jest.fn().mockResolvedValue({
        items: [
          {
            id: 5,
            title: 'Public List',
            description: null,
            problemCount: 1,
            createdAt: new Date('2026-08-10T00:00:00Z'),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      findOnePublicForMcp: jest.fn().mockResolvedValue({
        id: 5,
        title: 'Public List',
        description: null,
        problemCount: 1,
        items: [
          {
            order: 1,
            id: 7,
            slug: 'sample-public',
            title: 'Sample Public Problem',
            difficulty: 'IRON',
            score: 10,
            tags: ['sample'],
          },
        ],
      }),
    } as unknown as ProblemListService;
    submissionService = {
      getMyPublicProblemStatus: jest.fn().mockResolvedValue([
        {
          id: 7,
          slug: 'sample-public',
          title: 'Sample Public Problem',
          status: 'AC',
        },
      ]),
      listMyPublicSubmissions: jest.fn().mockResolvedValue({
        items: [
          {
            id: 99,
            language: 'cpp',
            status: 'AC',
            score: 100,
            timeUsed: 12,
            memoryUsed: 1024,
            createdAt: new Date('2026-08-10T00:00:00Z'),
            problem: {
              id: 7,
              slug: 'sample-public',
              title: 'Sample Public Problem',
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      getMyPublicSubmission: jest.fn().mockResolvedValue({
        id: 99,
        language: 'cpp',
        status: 'AC',
        score: 100,
        timeUsed: 12,
        memoryUsed: 1024,
        createdAt: new Date('2026-08-10T00:00:00Z'),
        codeSize: 123,
        problem: {
          id: 7,
          slug: 'sample-public',
          title: 'Sample Public Problem',
        },
      }),
    };
    const oauthService = {
      publicBaseUrl: 'http://127.0.0.1',
      resourceUrl: 'http://127.0.0.1/mcp/private',
      metadata: {
        issuer: 'http://127.0.0.1',
        authorization_endpoint: 'http://127.0.0.1/api/mcp-oauth/authorize',
        token_endpoint: 'http://127.0.0.1/api/mcp-oauth/token',
        registration_endpoint: 'http://127.0.0.1/api/mcp-oauth/register',
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
      } as OAuthMetadata,
      verifyAccessToken: jest.fn((token: string): Promise<AuthInfo> => {
        if (token === 'invalid')
          return Promise.reject(
            new OAuthError(OAuthErrorCode.InvalidToken, 'invalid'),
          );
        const expiresAt =
          token === 'expired'
            ? Math.floor(Date.now() / 1000) - 10
            : Math.floor(Date.now() / 1000) + 3600;
        return Promise.resolve({
          token,
          clientId: 'test-client',
          scopes:
            token === 'limited'
              ? ['problems:read']
              : ['problems:read', 'submissions:read'],
          expiresAt,
          resource: new URL('http://127.0.0.1/mcp/private'),
          extra: { userId: 42, username: 'teacher', role: 'TEACHER' },
        });
      }),
    } as unknown as McpOAuthService;

    const app = express();
    app.use(express.json());
    mountMcpEndpoint(
      app,
      new McpService(
        problemService,
        problemListService,
        submissionService as unknown as SubmissionService,
        tagService,
      ),
      oauthService,
    );
    httpServer = await new Promise<Server>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string')
      throw new Error('HTTP test server did not bind');

    baseUrl = `http://127.0.0.1:${address.port}`;
    transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
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
    expect(tools.tools).toHaveLength(6);
  });

  it('calls all Phase 1 tools over Streamable HTTP', async () => {
    const search = await client.callTool({
      name: 'search_problems',
      arguments: {},
    });
    const tags = await client.callTool({
      name: 'list_tags',
      arguments: { keyword: 'sample' },
    });
    const detail = await client.callTool({
      name: 'get_problem',
      arguments: { problem: 'sample-public' },
    });
    const markdown = await client.callTool({
      name: 'get_problem_markdown',
      arguments: { problem: '7' },
    });
    const lists = await client.callTool({
      name: 'list_problem_lists',
      arguments: {},
    });
    const list = await client.callTool({
      name: 'get_problem_list',
      arguments: { listId: 5 },
    });

    expect(search.isError).not.toBe(true);
    expect(tags.structuredContent).toEqual({
      items: [{ name: 'sample', problemCount: 1 }],
      total: 1,
    });
    expect(detail.structuredContent).toEqual(
      expect.objectContaining({ slug: 'sample-public' }),
    );
    const firstContent = markdown.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Public statement');
    }
    expect(lists.isError).not.toBe(true);
    expect(list.structuredContent).toEqual(expect.objectContaining({ id: 5 }));
  });

  it('returns OAuth discovery metadata and 401 challenges for protected MCP', async () => {
    const metadata = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp/private`,
    );
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toEqual(
      expect.objectContaining({
        resource: 'http://127.0.0.1/mcp/private',
        scopes_supported: ['problems:read', 'submissions:read'],
      }),
    );

    for (const token of [undefined, 'invalid', 'expired']) {
      const response = await fetch(`${baseUrl}/mcp/private`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'test', version: '1' },
          },
        }),
      });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain(
        'resource_metadata=',
      );
    }
  });

  it('uses authenticated context identity and exposes all nine tools only on the private endpoint', async () => {
    const privateTransport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp/private`),
      {
        requestInit: { headers: { Authorization: 'Bearer good' } },
      },
    );
    const privateClient = new Client({
      name: 'authorized-test',
      version: '1.0.0',
    });
    await privateClient.connect(privateTransport);
    try {
      const tools = await privateClient.listTools();
      expect(tools.tools).toHaveLength(9);
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'get_my_problem_status',
          'list_my_submissions',
          'get_submission',
        ]),
      );
      await privateClient.callTool({
        name: 'get_my_problem_status',
        arguments: { problemIds: [7], userId: 999 },
      });
      expect(submissionService.getMyPublicProblemStatus).toHaveBeenCalledWith(
        42,
        [7],
      );
      const detail = await privateClient.callTool({
        name: 'get_submission',
        arguments: { submissionId: 99, userId: 999 },
      });
      expect(submissionService.getMyPublicSubmission).toHaveBeenCalledWith(
        42,
        99,
      );
      expect(JSON.stringify(detail)).not.toContain('source code body');
      expect(detail.structuredContent).toEqual(
        expect.objectContaining({ sourceCodeIncluded: false, codeSize: 123 }),
      );
    } finally {
      await privateClient.close();
    }
  });

  it('returns HTTP 403 with the required scope for a protected tool call', async () => {
    submissionService.getMyPublicSubmission.mockClear();
    const limitedTransport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp/private`),
      {
        requestInit: { headers: { Authorization: 'Bearer limited' } },
      },
    );
    const limitedClient = new Client({
      name: 'limited-test',
      version: '1.0.0',
    });
    await limitedClient.connect(limitedTransport);
    try {
      await expect(
        limitedClient.callTool({
          name: 'get_submission',
          arguments: { submissionId: 99 },
        }),
      ).rejects.toThrow();
      expect(submissionService.getMyPublicSubmission).not.toHaveBeenCalledWith(
        42,
        99,
      );
    } finally {
      await limitedClient.close();
    }
  });
});
