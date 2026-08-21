import { Logger, NotFoundException } from '@nestjs/common';
import {
  McpServer,
  type AuthInfo,
  type CallToolResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { createHash } from 'node:crypto';
import * as z from 'zod/v4';
import { ProblemService } from '../../problem/problem.service';
import { TestcaseStoreService } from '../../testcase/testcase-store.service';
import { TestcaseStoreError } from '../../testcase/testcase.types';
import {
  McpAdminAuditOperationConflictError,
  McpAdminAuditService,
} from '../admin-audit.service';

const problemIdentifier = z.string().trim().min(1).max(200);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const operationId = z.uuid();
const testcaseText = z.string().max(8 * 1024 * 1024);

const listSchema = z.object({ problem: problemIdentifier });
const getSchema = z.object({
  problem: problemIdentifier,
  index: z.number().int().positive().safe(),
  inputOffset: z.number().int().min(0).safe().default(0),
  outputOffset: z.number().int().min(0).safe().default(0),
  maxCharsPerField: z.number().int().min(1).max(65_536).optional(),
});
const addSchema = z.object({
  problem: problemIdentifier,
  input: testcaseText,
  expectedOutput: testcaseText,
  expectedRevision: revision,
  operationId,
});
const deleteSchema = z.object({
  problem: problemIdentifier,
  index: z.number().int().positive().safe(),
  expectedRevision: revision,
  operationId,
  confirm: z.literal(true),
});

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export interface AdminWriteRateLimiter {
  consumeAdminWriteRateLimit(actorUserId: number): {
    allowed: boolean;
    retryAfterSeconds: number;
  };
}

export function registerAdminTestcaseTools(
  server: McpServer,
  problemService: ProblemService,
  testcaseStore: TestcaseStoreService,
  audit: McpAdminAuditService,
  rateLimiter: AdminWriteRateLimiter,
  logger: Logger,
): void {
  server.registerTool(
    'list_problem_testcases',
    {
      title: 'List problem testcases',
      description:
        'List hidden testcase metadata, integrity anomalies and the current revision for one problem. ADMIN and testcases:read are required.',
      inputSchema: listSchema,
      annotations: readAnnotations,
    },
    async ({ problem }, context) =>
      runAdminTool(
        'list_problem_testcases',
        'testcases:read',
        context,
        logger,
        async (auth) => {
          let reference:
            | { id: number; slug: string; title: string }
            | undefined;
          try {
            reference = await resolveProblem(problemService, problem);
            const scan = await testcaseStore.scan(reference.slug);
            await audit.recordReadSuccess({
              ...auditActor(auth, context),
              toolName: 'list_problem_testcases',
              action: 'LIST_TESTCASES',
              problemId: reference.id,
              problemSlugSnapshot: reference.slug,
              beforeCount: scan.testcaseCount,
            });
            const result = { problem: reference, ...scan };
            return textAndStructured(
              `${reference.slug}: ${scan.testcaseCount} complete testcase(s); valid=${scan.valid}.`,
              result,
            );
          } catch (error) {
            await audit.recordReadFailure(
              {
                ...auditActor(auth, context),
                toolName: 'list_problem_testcases',
                action: 'LIST_TESTCASES',
                problemId: reference?.id,
                problemSlugSnapshot: reference?.slug,
              },
              errorCode(error),
            );
            throw error;
          }
        },
      ),
  );

  server.registerTool(
    'get_problem_testcase',
    {
      title: 'Read a problem testcase',
      description:
        'Read bounded chunks of one hidden testcase input and expected output. ADMIN and testcases:read are required.',
      inputSchema: getSchema,
      annotations: readAnnotations,
    },
    async (input, context) =>
      runAdminTool(
        'get_problem_testcase',
        'testcases:read',
        context,
        logger,
        async (auth) => {
          let reference:
            | { id: number; slug: string; title: string }
            | undefined;
          try {
            reference = await resolveProblem(problemService, input.problem);
            const result = await testcaseStore.readChunk(
              reference.slug,
              input.index,
              input.inputOffset,
              input.outputOffset,
              input.maxCharsPerField,
            );
            const base = {
              ...auditActor(auth, context),
              toolName: 'get_problem_testcase',
              problemId: reference.id,
              problemSlugSnapshot: reference.slug,
              testcaseIndex: input.index,
            };
            await Promise.all([
              audit.recordReadSuccess({
                ...base,
                action: 'READ_TESTCASE_INPUT',
                inputBytes: result.input.totalBytes,
                inputSha256: result.input.sha256,
                contentOffset: result.input.offset,
                contentLength: result.input.content.length,
              }),
              audit.recordReadSuccess({
                ...base,
                action: 'READ_TESTCASE_OUTPUT',
                outputBytes: result.expectedOutput.totalBytes,
                outputSha256: result.expectedOutput.sha256,
                contentOffset: result.expectedOutput.offset,
                contentLength: result.expectedOutput.content.length,
              }),
            ]);
            const response = { problem: reference, ...result };
            return textAndStructured(
              `${reference.slug} testcase ${input.index}: returned bounded input and output chunks.`,
              response,
            );
          } catch (error) {
            await audit.recordReadFailure(
              {
                ...auditActor(auth, context),
                toolName: 'get_problem_testcase',
                action: 'READ_TESTCASE',
                problemId: reference?.id,
                problemSlugSnapshot: reference?.slug,
                testcaseIndex: input.index,
              },
              errorCode(error),
            );
            throw error;
          }
        },
      ),
  );

  server.registerTool(
    'add_problem_testcase',
    {
      title: 'Append a problem testcase',
      description:
        'Atomically append one hidden testcase using revision and operation-id safeguards. ADMIN and testcases:write are required.',
      inputSchema: addSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, context) =>
      runAdminTool(
        'add_problem_testcase',
        'testcases:write',
        context,
        logger,
        async (auth) => {
          enforceWriteRateLimit(rateLimiter, auth);
          const reference = await resolveProblem(problemService, input.problem);
          const actorUserId = userIdFrom(auth);
          const inputSha256 = sha256(input.input);
          const outputSha256 = sha256(input.expectedOutput);
          const replay = await replayWrite(
            audit,
            actorUserId,
            input.operationId,
            {
              toolName: 'add_problem_testcase',
              problemId: reference.id,
              testcaseIndex: null,
              inputSha256,
              outputSha256,
              expectedRevision: input.expectedRevision,
            },
          );
          if (replay)
            return textAndStructured('Idempotent append replay.', replay);

          const before = await testcaseStore.scan(reference.slug);
          let auditEntry: { id: number };
          try {
            auditEntry = await audit.begin({
              ...auditActor(auth, context),
              operationId: input.operationId,
              toolName: 'add_problem_testcase',
              action: 'ADD_TESTCASE',
              problemId: reference.id,
              problemSlugSnapshot: reference.slug,
              beforeCount: before.testcaseCount,
              afterCount: before.testcaseCount + 1,
              inputBytes: Buffer.byteLength(input.input, 'utf8'),
              outputBytes: Buffer.byteLength(input.expectedOutput, 'utf8'),
              inputSha256,
              outputSha256,
            });
          } catch (error) {
            if (error instanceof McpAdminAuditOperationConflictError) {
              const racedReplay = replayFromEntry(error.existing, {
                toolName: 'add_problem_testcase',
                problemId: reference.id,
                testcaseIndex: null,
                inputSha256,
                outputSha256,
                expectedRevision: input.expectedRevision,
              });
              if (racedReplay)
                return textAndStructured(
                  'Idempotent append replay.',
                  racedReplay,
                );
              throw new AdminToolError(
                'OPERATION_ID_CONFLICT',
                'Operation id was already used.',
              );
            }
            throw error;
          }

          try {
            const mutation = await testcaseStore.append(
              reference.slug,
              { input: input.input, expectedOutput: input.expectedOutput },
              input.expectedRevision,
            );
            const response = {
              problem: { id: reference.id, slug: reference.slug },
              addedIndex: mutation.addedIndex,
              testcaseCount: mutation.testcaseCount,
              previousRevision: mutation.previousRevision,
              revision: mutation.revision,
              replayed: false,
            };
            await finishAuditSuccess(audit, auditEntry.id, response, logger);
            return textAndStructured(
              `${reference.slug}: appended testcase ${mutation.addedIndex}.`,
              response,
            );
          } catch (error) {
            await finishAuditFailure(
              audit,
              auditEntry.id,
              errorCode(error),
              logger,
            );
            throw error;
          }
        },
      ),
  );

  server.registerTool(
    'delete_problem_testcase',
    {
      title: 'Delete a problem testcase',
      description:
        'Atomically delete and renumber one hidden testcase. ADMIN, testcases:write, expected revision and explicit confirmation are required.',
      inputSchema: deleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input, context) =>
      runAdminTool(
        'delete_problem_testcase',
        'testcases:write',
        context,
        logger,
        async (auth) => {
          enforceWriteRateLimit(rateLimiter, auth);
          const reference = await resolveProblem(problemService, input.problem);
          const actorUserId = userIdFrom(auth);
          const comparison = {
            toolName: 'delete_problem_testcase',
            problemId: reference.id,
            testcaseIndex: input.index,
            expectedRevision: input.expectedRevision,
          };
          const replay = await replayWrite(
            audit,
            actorUserId,
            input.operationId,
            comparison,
          );
          if (replay)
            return textAndStructured('Idempotent delete replay.', replay);

          const before = await testcaseStore.scan(reference.slug);
          const deleted = before.items.find(
            (item) => item.index === input.index,
          );
          if (!deleted) {
            throw new TestcaseStoreError(
              'TESTCASE_NOT_FOUND',
              'Testcase not found.',
            );
          }
          let auditEntry: { id: number };
          try {
            auditEntry = await audit.begin({
              ...auditActor(auth, context),
              operationId: input.operationId,
              toolName: 'delete_problem_testcase',
              action: 'DELETE_TESTCASE',
              problemId: reference.id,
              problemSlugSnapshot: reference.slug,
              testcaseIndex: input.index,
              beforeCount: before.testcaseCount,
              afterCount: before.testcaseCount - 1,
              inputBytes: deleted.inputBytes,
              outputBytes: deleted.outputBytes,
              inputSha256: deleted.inputSha256,
              outputSha256: deleted.outputSha256,
            });
          } catch (error) {
            if (error instanceof McpAdminAuditOperationConflictError) {
              const racedReplay = replayFromEntry(error.existing, comparison);
              if (racedReplay)
                return textAndStructured(
                  'Idempotent delete replay.',
                  racedReplay,
                );
              throw new AdminToolError(
                'OPERATION_ID_CONFLICT',
                'Operation id was already used.',
              );
            }
            throw error;
          }

          try {
            const mutation = await testcaseStore.deleteAndRenumber(
              reference.slug,
              input.index,
              input.expectedRevision,
            );
            const response = {
              problem: { id: reference.id, slug: reference.slug },
              deletedIndex: input.index,
              testcaseCount: mutation.testcaseCount,
              renumbered: mutation.renumbered,
              previousRevision: mutation.previousRevision,
              revision: mutation.revision,
              replayed: false,
              ...(mutation.testcaseCount === 0
                ? {
                    warning:
                      'This problem now has no testcases and cannot be judged.',
                  }
                : {}),
            };
            await finishAuditSuccess(audit, auditEntry.id, response, logger);
            return textAndStructured(
              `${reference.slug}: deleted testcase ${input.index}.`,
              response,
            );
          } catch (error) {
            await finishAuditFailure(
              audit,
              auditEntry.id,
              errorCode(error),
              logger,
            );
            throw error;
          }
        },
      ),
  );
}

class AdminToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function runAdminTool(
  toolName: string,
  requiredScope: string,
  context: ServerContext,
  logger: Logger,
  operation: (auth: AuthInfo) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  const auth = context.http?.authInfo;
  const actor = auth?.extra?.userId;
  try {
    if (!auth) return toolError('UNAUTHORIZED', 'Authorization required.');
    if (auth.extra?.role !== 'ADMIN')
      return toolError('ADMIN_REQUIRED', 'Administrator role required.');
    if (!auth.scopes.includes(requiredScope)) {
      return toolError(
        'INSUFFICIENT_SCOPE',
        `Insufficient scope: ${requiredScope} required.`,
      );
    }
    const result = await operation(auth);
    logger.log(
      `tool=${toolName} requestId=${String(context.mcpReq.id)} durationMs=${Date.now() - startedAt} success=true actor=user:${String(actor)}`,
    );
    return result;
  } catch (error) {
    const safeCode = errorCode(error);
    logger.error(
      `tool=${toolName} requestId=${String(context.mcpReq.id)} durationMs=${Date.now() - startedAt} success=false code=${safeCode} actor=user:${String(actor)}`,
      error instanceof Error ? error.stack : undefined,
    );
    return toolError(safeCode, errorMessage(safeCode));
  }
}

async function resolveProblem(service: ProblemService, value: string) {
  const idOrSlug = /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (typeof idOrSlug === 'number' && !Number.isSafeInteger(idOrSlug)) {
    throw new AdminToolError('INVALID_ARGUMENT', 'Invalid problem identifier.');
  }
  return service.findAdminProblemReference(idOrSlug);
}

function enforceWriteRateLimit(
  rateLimiter: AdminWriteRateLimiter,
  auth: AuthInfo,
): void {
  const result = rateLimiter.consumeAdminWriteRateLimit(userIdFrom(auth));
  if (!result.allowed) {
    throw new AdminToolError(
      'RATE_LIMITED',
      'Administrator write rate exceeded.',
    );
  }
}

function auditActor(auth: AuthInfo, context: ServerContext) {
  return {
    actorUserId: userIdFrom(auth),
    actorUsernameSnapshot:
      typeof auth.extra?.username === 'string' ? auth.extra.username : null,
    clientId: auth.clientId,
    requestId: String(context.mcpReq.id),
  };
}

interface ReplayComparison {
  toolName: string;
  problemId: number;
  testcaseIndex?: number | null;
  inputSha256?: string;
  outputSha256?: string;
  expectedRevision: string;
}

async function replayWrite(
  audit: McpAdminAuditService,
  actorUserId: number,
  operationIdValue: string,
  comparison: ReplayComparison,
): Promise<Record<string, unknown> | null> {
  const existing = await audit.findWriteByOperationId(
    actorUserId,
    operationIdValue,
  );
  if (!existing) return null;
  const replay = replayFromEntry(existing, comparison);
  if (replay) return replay;
  throw new AdminToolError(
    'OPERATION_ID_CONFLICT',
    'Operation id was already used.',
  );
}

function replayFromEntry(
  existing: {
    toolName: string;
    problemId: number | null;
    testcaseIndex: number | null;
    inputSha256: string | null;
    outputSha256: string | null;
    success: boolean | null;
    resultJson: unknown;
  },
  comparison: ReplayComparison,
): Record<string, unknown> | null {
  const result = isRecord(existing.resultJson) ? existing.resultJson : null;
  const previousRevision = result?.previousRevision;
  const matches =
    existing.toolName === comparison.toolName &&
    existing.problemId === comparison.problemId &&
    existing.testcaseIndex === (comparison.testcaseIndex ?? null) &&
    (comparison.inputSha256 === undefined ||
      existing.inputSha256 === comparison.inputSha256) &&
    (comparison.outputSha256 === undefined ||
      existing.outputSha256 === comparison.outputSha256) &&
    previousRevision === comparison.expectedRevision;
  if (!matches || existing.success !== true || !result) return null;
  return { ...result, replayed: true };
}

async function finishAuditSuccess(
  audit: McpAdminAuditService,
  id: number,
  response: Record<string, unknown>,
  logger: Logger,
): Promise<void> {
  try {
    await audit.completeSuccess(id, response);
  } catch (error) {
    logger.error(
      `HIGH_PRIORITY audit completion failed auditId=${id}; record remains PENDING for manual review.`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

async function finishAuditFailure(
  audit: McpAdminAuditService,
  id: number,
  code: string,
  logger: Logger,
): Promise<void> {
  try {
    await audit.completeFailure(id, code);
  } catch (error) {
    logger.error(
      `HIGH_PRIORITY audit failure update failed auditId=${id}; record remains PENDING for manual review.`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

function userIdFrom(auth: AuthInfo): number {
  const value = auth.extra?.userId;
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new AdminToolError(
      'UNAUTHORIZED',
      'Authenticated user is unavailable.',
    );
  }
  return Number(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function errorCode(error: unknown): string {
  if (error instanceof TestcaseStoreError || error instanceof AdminToolError)
    return error.code;
  if (error instanceof NotFoundException) return 'PROBLEM_NOT_FOUND';
  return 'INTERNAL_ERROR';
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'Authorization required.',
    ADMIN_REQUIRED: 'Administrator role required.',
    INSUFFICIENT_SCOPE: 'Required OAuth scope is missing.',
    PROBLEM_NOT_FOUND: 'Problem not found.',
    TESTCASE_NOT_FOUND: 'Testcase not found.',
    TESTCASE_SET_INVALID: 'Testcase set is incomplete or unsafe.',
    REVISION_CONFLICT: 'Testcase revision conflict.',
    OPERATION_ID_CONFLICT: 'Operation id was already used.',
    PAYLOAD_TOO_LARGE: 'Testcase content is too large.',
    TESTCASE_LIMIT_EXCEEDED: 'Testcase count limit exceeded.',
    RATE_LIMITED: 'Administrator write rate exceeded.',
    INVALID_ARGUMENT: 'Invalid argument.',
    INTERNAL_ERROR: 'Internal ETLOJ error.',
  };
  return messages[code] || messages.INTERNAL_ERROR;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
