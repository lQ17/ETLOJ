import { HttpException, Logger, NotFoundException } from '@nestjs/common';
import {
  McpServer,
  type CallToolResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DIFFICULTY_VALUES } from '../../problem/difficulty.constants';
import { ProblemService } from '../../problem/problem.service';

const searchProblemsSchema = z.object({
  keyword: z.string().trim().min(1).max(100).optional(),
  difficulty: z.enum(DIFFICULTY_VALUES).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  tagMode: z.enum(['AND', 'OR']).default('OR'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

const problemIdentifierSchema = z.object({
  problem: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(
      (value) => !value.includes('..') && !/[\\/]/.test(value),
      'problem must be a numeric id or slug',
    ),
});

type ProblemIdentifier = number | string;

export function registerProblemTools(
  server: McpServer,
  problemService: ProblemService,
  logger: Logger,
): void {
  server.registerTool(
    'search_problems',
    {
      title: 'Search ETLOJ problems',
      description:
        'Search public ETLOJ programming problems by keyword, difficulty and tags.',
      inputSchema: searchProblemsSchema,
      annotations: readOnlyAnnotations,
    },
    async (input, context) =>
      runTool('search_problems', context, logger, async () => {
        const result = await problemService.findAll(
          {
            keyword: input.keyword,
            difficulty: input.difficulty,
            tags: input.tags,
            tagMode: input.tagMode,
            page: input.page,
            pageSize: input.pageSize,
          },
          false,
        );

        const items = result.items.map((problem) => ({
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
          difficulty: problem.difficulty,
          tags: problem.tags,
          score: problem.score,
          limits: {
            timeMs: problem.timeLimit,
            memoryMb: problem.memoryLimit,
          },
          stats: problem.stats,
        }));
        const structuredContent = {
          items,
          total: result.total,
          page: input.page,
          pageSize: input.pageSize,
        };
        const readable =
          items.length === 0
            ? 'No public ETLOJ problems matched the search.'
            : [
                `Found ${result.total} public ETLOJ problem(s); showing page ${input.page}.`,
                ...items.map(
                  (problem) =>
                    `- ${problem.slug}: ${problem.title} [${problem.difficulty}]${problem.tags.length ? ` (${problem.tags.join(', ')})` : ''}`,
                ),
              ].join('\n');

        return textAndStructured(readable, structuredContent);
      }),
  );

  server.registerTool(
    'get_problem',
    {
      title: 'Get an ETLOJ problem',
      description:
        'Get the public statement and metadata for an ETLOJ problem by numeric id or slug.',
      inputSchema: problemIdentifierSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ problem }, context) =>
      runTool('get_problem', context, logger, async () => {
        const result = await problemService.findOne(
          parseProblemIdentifier(problem),
          false,
        );
        const structuredContent = {
          id: result.id,
          slug: result.slug,
          title: result.title,
          difficulty: result.difficulty,
          tags: result.tags,
          statement: result.markdown,
          limits: {
            timeMs: result.timeLimit,
            memoryMb: result.memoryLimit,
          },
          score: result.score,
          testcaseCount: result.testcaseCount,
          stats: result.stats,
        };
        const readable = [
          `# ${result.slug} ${result.title}`,
          '',
          `Difficulty: ${result.difficulty}`,
          `Tags: ${result.tags.length ? result.tags.join(', ') : 'None'}`,
          `Limits: ${result.timeLimit} ms, ${result.memoryLimit} MB`,
          '',
          result.markdown,
        ].join('\n');

        return textAndStructured(readable, structuredContent);
      }),
  );

  server.registerTool(
    'get_problem_markdown',
    {
      title: 'Get ETLOJ problem Markdown',
      description:
        'Get the original Markdown for a public ETLOJ problem by numeric id or slug.',
      inputSchema: problemIdentifierSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ problem }, context) =>
      runTool('get_problem_markdown', context, logger, async () => {
        const markdown = await problemService.getMarkdown(
          parseProblemIdentifier(problem),
        );
        return textAndStructured(markdown, { problem, markdown });
      }),
  );
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function parseProblemIdentifier(value: string): ProblemIdentifier {
  if (!/^\d+$/.test(value)) return value;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new InvalidProblemIdentifierError();
  }
  return id;
}

async function runTool(
  toolName: string,
  context: ServerContext,
  logger: Logger,
  operation: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  const requestId = String(context.mcpReq.id);
  try {
    const result = await operation();
    logger.log(
      `tool=${toolName} requestId=${requestId} durationMs=${Date.now() - startedAt} success=true actor=anonymous`,
    );
    return result;
  } catch (error) {
    const safe = toSafeError(error);
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    logger.error(
      `tool=${toolName} requestId=${requestId} durationMs=${Date.now() - startedAt} success=false code=${safe.code} actor=anonymous`,
      detail,
    );
    return {
      isError: true,
      structuredContent: { error: safe },
      content: [{ type: 'text', text: safe.message }],
    };
  }
}

function textAndStructured(
  text: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return {
    structuredContent,
    content: [{ type: 'text', text }],
  };
}

function toSafeError(error: unknown): { code: string; message: string } {
  if (error instanceof InvalidProblemIdentifierError) {
    return {
      code: 'INVALID_PROBLEM_IDENTIFIER',
      message: 'Invalid problem identifier.',
    };
  }
  if (error instanceof NotFoundException) {
    return { code: 'PROBLEM_NOT_FOUND', message: 'Problem not found.' };
  }
  if (error instanceof HttpException && error.getStatus() < 500) {
    return { code: 'INVALID_REQUEST', message: 'Invalid request.' };
  }
  return { code: 'INTERNAL_ERROR', message: 'Internal ETLOJ error.' };
}

class InvalidProblemIdentifierError extends Error {}
