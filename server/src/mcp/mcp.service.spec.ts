import { NotFoundException } from '@nestjs/common';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { ProblemService } from '../problem/problem.service';
import { TagService } from '../tag/tag.service';
import { McpService } from './mcp.service';

describe('McpService problem tools', () => {
  const publicProblem = {
    id: 1,
    slug: 'prefix-sum-basic',
    title: 'Prefix Sum Basic',
    difficulty: 'BRONZE',
    tags: ['prefix-sum'],
    score: 20,
    timeLimit: 1000,
    memoryLimit: 256,
    markdown: '# prefix-sum-basic Prefix Sum Basic\nStatement',
    testcaseCount: 2,
    stats: {
      totalSubmissions: 3,
      acceptedSubmissions: 2,
      acceptanceRate: 2 / 3,
    },
  };

  let problemService: jest.Mocked<
    Pick<ProblemService, 'findAll' | 'findOne' | 'getMarkdown'>
  >;
  let tagService: jest.Mocked<Pick<TagService, 'findPublicTags'>>;
  let client: Client;

  beforeEach(async () => {
    problemService = {
      findAll: jest.fn().mockResolvedValue({
        items: [publicProblem],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      findOne: jest.fn().mockResolvedValue(publicProblem),
      getMarkdown: jest.fn().mockResolvedValue(publicProblem.markdown),
    };
    tagService = {
      findPublicTags: jest.fn().mockResolvedValue([
        { name: 'prefix-sum', problemCount: 3 },
        { name: 'simulation', problemCount: 1 },
      ]),
    };

    const server = new McpService(
      problemService as unknown as ProblemService,
      tagService as unknown as TagService,
    ).createServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'etloj-test', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  it('lists exactly the four public read-only tools', async () => {
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      'get_problem',
      'get_problem_markdown',
      'list_tags',
      'search_problems',
    ]);
    const listTags = result.tools.find((tool) => tool.name === 'list_tags');
    expect(listTags?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('lists only public tag statistics with a field whitelist', async () => {
    const result = await client.callTool({
      name: 'list_tags',
      arguments: { keyword: ' prefix ' },
    });

    expect(tagService.findPublicTags).toHaveBeenCalledWith('prefix');
    expect(result.structuredContent).toEqual({
      items: [
        { name: 'prefix-sum', problemCount: 3 },
        { name: 'simulation', problemCount: 1 },
      ],
      total: 2,
    });
    expect(JSON.stringify(result)).not.toContain('description');
    expect(JSON.stringify(result)).not.toContain('createdAt');
  });

  it('rejects list_tags keywords above the public limit', async () => {
    const result = await client.callTool({
      name: 'list_tags',
      arguments: { keyword: 'x'.repeat(51) },
    });

    expect(result.isError).toBe(true);
    expect(tagService.findPublicTags).not.toHaveBeenCalled();
  });

  it('searches only as a non-admin and returns structured content', async () => {
    const result = await client.callTool({
      name: 'search_problems',
      arguments: { keyword: 'prefix', pageSize: 10 },
    });

    expect(problemService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'prefix', pageSize: 10 }),
      false,
    );
    expect(result.structuredContent).toEqual(
      expect.objectContaining({ total: 1 }),
    );
  });

  it('reads details only through the public service path', async () => {
    await client.callTool({ name: 'get_problem', arguments: { problem: '1' } });
    expect(problemService.findOne).toHaveBeenCalledWith(1, false);
  });

  it('does not expose hidden-problem errors', async () => {
    problemService.findOne.mockRejectedValueOnce(
      new NotFoundException('hidden problem'),
    );
    const result = await client.callTool({
      name: 'get_problem',
      arguments: { problem: 'hidden-problem' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Problem not found.' },
    ]);
    expect(JSON.stringify(result)).not.toContain('hidden problem');
  });

  it('rejects page sizes above the public limit', async () => {
    const result = await client.callTool({
      name: 'search_problems',
      arguments: { pageSize: 51 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Input validation error');
    expect(problemService.findAll).not.toHaveBeenCalled();
  });
});
