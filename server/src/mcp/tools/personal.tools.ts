import { Logger, NotFoundException } from '@nestjs/common';
import {
  McpServer,
  type AuthInfo,
  type CallToolResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { SubmissionStatus } from '@prisma/client';
import * as z from 'zod/v4';
import { SubmissionService } from '../../submission/submission.service';

const submissionStatuses = Object.values(SubmissionStatus) as [
  SubmissionStatus,
  ...SubmissionStatus[],
];
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const problemStatusSchema = z.object({
  problemIds: z.array(z.number().int().positive().safe()).min(1).max(100),
});

const listSubmissionsSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(50).default(20),
    problemId: z.number().int().positive().safe().optional(),
    status: z.enum(submissionStatuses).optional(),
    language: z.string().trim().min(1).max(20).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'from must not be after to',
  });

const getSubmissionSchema = z.object({
  submissionId: z.number().int().positive().safe(),
});

export function registerPersonalTools(
  server: McpServer,
  service: SubmissionService,
  logger: Logger,
): void {
  server.registerTool(
    'get_my_problem_status',
    {
      title: 'Get my ETLOJ problem status',
      description:
        'Get the authenticated user’s AC, ATTEMPTED or UNATTEMPTED status for public problems.',
      inputSchema: problemStatusSchema,
      annotations,
    },
    async ({ problemIds }, context) =>
      runPersonalTool(
        'get_my_problem_status',
        'problems:read',
        context,
        logger,
        async (auth) => {
          const items = await service.getMyPublicProblemStatus(
            userIdFrom(auth),
            problemIds,
          );
          return textAndStructured(
            items.map((item) => `${item.slug}: ${item.status}`).join('\n'),
            { items },
          );
        },
      ),
  );

  server.registerTool(
    'list_my_submissions',
    {
      title: 'List my ETLOJ submissions',
      description:
        'List safe summaries of the authenticated user’s submissions to public problems.',
      inputSchema: listSubmissionsSchema,
      annotations,
    },
    async (input, context) =>
      runPersonalTool(
        'list_my_submissions',
        'submissions:read',
        context,
        logger,
        async (auth) => {
          const result = await service.listMyPublicSubmissions(
            userIdFrom(auth),
            {
              page: input.page,
              pageSize: input.pageSize,
              problemId: input.problemId,
              status: input.status,
              language: input.language,
              from: input.from ? new Date(input.from) : undefined,
              to: input.to ? new Date(input.to) : undefined,
            },
          );
          const structuredContent = {
            items: result.items.map((item) => ({
              ...item,
              createdAt: item.createdAt.toISOString(),
            })),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
          };
          return textAndStructured(
            structuredContent.items.length
              ? structuredContent.items
                  .map(
                    (item) => `${item.id}: ${item.problem.slug} ${item.status}`,
                  )
                  .join('\n')
              : 'No submissions matched the filter.',
            structuredContent,
          );
        },
      ),
  );

  server.registerTool(
    'get_submission',
    {
      title: 'Get my ETLOJ submission',
      description:
        'Get a minimized, whitelisted view of one authenticated user-owned submission. Source code is omitted.',
      inputSchema: getSubmissionSchema,
      annotations,
    },
    async ({ submissionId }, context) =>
      runPersonalTool(
        'get_submission',
        'submissions:read',
        context,
        logger,
        async (auth) => {
          const item = await service.getMyPublicSubmission(
            userIdFrom(auth),
            submissionId,
          );
          const structuredContent = {
            ...item,
            createdAt: item.createdAt.toISOString(),
            sourceCodeIncluded: false,
          };
          return textAndStructured(
            `${item.id}: ${item.problem.slug} ${item.status}; ${item.language}; source code omitted (${item.codeSize} bytes).`,
            structuredContent,
          );
        },
      ),
  );
}

async function runPersonalTool(
  toolName: string,
  requiredScope: string,
  context: ServerContext,
  logger: Logger,
  operation: (auth: AuthInfo) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  const auth = context.http?.authInfo;
  const actorUserId = auth?.extra?.userId;
  const actor = auth
    ? `user:${typeof actorUserId === 'number' ? actorUserId : 'unknown'}`
    : 'anonymous';
  try {
    if (!auth) return toolError('UNAUTHORIZED', 'Authorization required.');
    if (!auth.scopes.includes(requiredScope))
      return toolError(
        'INSUFFICIENT_SCOPE',
        `Insufficient scope: ${requiredScope} required.`,
      );
    const result = await operation(auth);
    logger.log(
      `tool=${toolName} requestId=${String(context.mcpReq.id)} durationMs=${Date.now() - startedAt} success=true actor=${actor}`,
    );
    return result;
  } catch (error) {
    const safe =
      error instanceof NotFoundException
        ? {
            code:
              toolName === 'get_my_problem_status'
                ? 'PROBLEM_NOT_FOUND'
                : 'SUBMISSION_NOT_FOUND',
            message:
              toolName === 'get_my_problem_status'
                ? 'Problem not found.'
                : 'Submission not found.',
          }
        : { code: 'INTERNAL_ERROR', message: 'Internal ETLOJ error.' };
    logger.error(
      `tool=${toolName} requestId=${String(context.mcpReq.id)} durationMs=${Date.now() - startedAt} success=false code=${safe.code} actor=${actor}`,
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    return toolError(safe.code, safe.message);
  }
}

function userIdFrom(auth: AuthInfo): number {
  const value = auth.extra?.userId;
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new Error('Authenticated context has no valid user identity.');
  return Number(value);
}

function toolError(code: string, message: string): CallToolResult {
  return {
    isError: true,
    structuredContent: { error: { code, message } },
    content: [{ type: 'text', text: message }],
  };
}

function textAndStructured(
  text: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return { structuredContent, content: [{ type: 'text', text }] };
}
