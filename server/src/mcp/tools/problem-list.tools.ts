import { HttpException, Logger, NotFoundException } from '@nestjs/common';
import {
  McpServer,
  type CallToolResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ProblemListService } from '../../problem-list/problem-list.service';

const listProblemListsSchema = z.object({
  keyword: z.string().trim().min(1).max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

const getProblemListSchema = z.object({
  listId: z.number().int().positive().safe(),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function registerProblemListTools(
  server: McpServer,
  service: ProblemListService,
  logger: Logger,
): void {
  server.registerTool(
    'list_problem_lists',
    {
      title: 'List ETLOJ public problem lists',
      description:
        'List public ETLOJ problem lists with public-problem counts.',
      inputSchema: listProblemListsSchema,
      annotations,
    },
    async (input, context) =>
      runTool('list_problem_lists', context, logger, async () => {
        const result = await service.findAllPublicForMcp(
          input.page,
          input.pageSize,
          input.keyword,
        );
        const structuredContent = {
          items: result.items.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            problemCount: item.problemCount,
            createdAt: item.createdAt.toISOString(),
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
        const readable =
          structuredContent.items.length === 0
            ? 'No public ETLOJ problem lists matched the search.'
            : [
                `Found ${structuredContent.total} public problem list(s); showing page ${structuredContent.page}.`,
                ...structuredContent.items.map(
                  (item) =>
                    `- ${item.id}: ${item.title} (${item.problemCount} public problem(s))`,
                ),
              ].join('\n');
        return textAndStructured(readable, structuredContent);
      }),
  );

  server.registerTool(
    'get_problem_list',
    {
      title: 'Get an ETLOJ public problem list',
      description:
        'Get a public ETLOJ problem list and its public problems in safe display order.',
      inputSchema: getProblemListSchema,
      annotations,
    },
    async ({ listId }, context) =>
      runTool('get_problem_list', context, logger, async () => {
        const list = await service.findOnePublicForMcp(listId);
        const structuredContent = {
          id: list.id,
          title: list.title,
          description: list.description,
          problemCount: list.problemCount,
          items: list.items,
        };
        const readable = [
          `# ${list.title}`,
          list.description ?? '',
          '',
          ...list.items.map(
            (item) =>
              `${item.order}. ${item.slug}: ${item.title} [${item.difficulty}]`,
          ),
        ].join('\n');
        return textAndStructured(readable, structuredContent);
      }),
  );
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

function toSafeError(error: unknown): { code: string; message: string } {
  if (error instanceof NotFoundException) {
    return {
      code: 'PROBLEM_LIST_NOT_FOUND',
      message: 'Problem list not found.',
    };
  }
  if (error instanceof HttpException && error.getStatus() < 500) {
    return { code: 'INVALID_REQUEST', message: 'Invalid request.' };
  }
  return { code: 'INTERNAL_ERROR', message: 'Internal ETLOJ error.' };
}

function textAndStructured(
  text: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return { structuredContent, content: [{ type: 'text', text }] };
}
