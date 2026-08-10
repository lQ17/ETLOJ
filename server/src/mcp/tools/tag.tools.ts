import { Logger } from '@nestjs/common';
import {
  McpServer,
  type CallToolResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { TagService } from '../../tag/tag.service';

const listTagsSchema = z.object({
  keyword: z.string().trim().min(1).max(50).optional(),
});

export function registerTagTools(
  server: McpServer,
  tagService: TagService,
  logger: Logger,
): void {
  server.registerTool(
    'list_tags',
    {
      title: 'List ETLOJ public problem tags',
      description:
        'List tags used by public ETLOJ problems, with public problem counts.',
      inputSchema: listTagsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ keyword }, context) =>
      runTool('list_tags', context, logger, async () => {
        const items = await tagService.findPublicTags(keyword);
        const structuredContent = { items, total: items.length };
        const readable =
          items.length === 0
            ? 'No public ETLOJ problem tags matched the filter.'
            : [
                `Found ${items.length} public ETLOJ problem tag(s).`,
                ...items.map(
                  (tag) =>
                    `- ${tag.name}: ${tag.problemCount} public problem(s)`,
                ),
              ].join('\n');

        return {
          structuredContent,
          content: [{ type: 'text', text: readable }],
        };
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
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    logger.error(
      `tool=${toolName} requestId=${requestId} durationMs=${Date.now() - startedAt} success=false code=INTERNAL_ERROR actor=anonymous`,
      detail,
    );
    return {
      isError: true,
      structuredContent: {
        error: { code: 'INTERNAL_ERROR', message: 'Internal ETLOJ error.' },
      },
      content: [{ type: 'text', text: 'Internal ETLOJ error.' }],
    };
  }
}
