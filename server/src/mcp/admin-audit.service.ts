import { Injectable } from '@nestjs/common';
import { McpAdminAuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Metadata which can safely be attached to an MCP audit entry.
 *
 * Deliberately there are no input/output content, token, credential, path, or
 * exception fields in this type.  Testcase contents are represented only by
 * byte counts, hashes, and read ranges.
 */
export interface McpAdminAuditMetadata {
  actorUserId: number;
  actorUsernameSnapshot?: string | null;
  clientId?: string | null;
  requestId?: string | null;
  toolName: string;
  action: string;
  problemId?: number | null;
  problemSlugSnapshot?: string | null;
  testcaseIndex?: number | null;
  beforeCount?: number | null;
  afterCount?: number | null;
  inputBytes?: number | null;
  outputBytes?: number | null;
  inputSha256?: string | null;
  outputSha256?: string | null;
  contentOffset?: number | null;
  contentLength?: number | null;
}

/** Input used to create a PENDING write entry. */
export interface McpAdminAuditBeginInput extends McpAdminAuditMetadata {
  /** A write idempotency key.  Read entries must not use this method. */
  operationId: string;
}

/** Input used to persist a sensitive read result. */
export type McpAdminAuditReadInput = McpAdminAuditMetadata;

export interface McpAdminAuditQuery {
  actorUserId?: number;
  problemId?: number;
  toolName?: string;
  action?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

/**
 * Thrown when an operation id already belongs to another write.  The caller
 * can inspect `existing` to decide whether this is a replay or a parameter
 * conflict without making a second database query.
 */
export class McpAdminAuditOperationConflictError extends Error {
  readonly code = 'OPERATION_ID_CONFLICT';

  constructor(readonly existing: McpAdminAuditLog) {
    super('The operationId has already been used by this administrator.');
    this.name = McpAdminAuditOperationConflictError.name;
  }
}

export class McpAdminAuditLifecycleError extends Error {
  readonly code = 'AUDIT_LIFECYCLE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = McpAdminAuditLifecycleError.name;
  }
}

/**
 * Persists administrator MCP audit events.
 *
 * The service intentionally contains no testcase or token parameters.  The
 * storage model has only aggregate metadata and a constrained, sanitized
 * resultJson for replaying successful write responses.
 */
@Injectable()
export class McpAdminAuditService {
  private static readonly DEFAULT_TAKE = 100;
  private static readonly MAX_TAKE = 500;
  // A delete response may contain up to 999 small renumbering pairs.  Keep
  // enough room for that idempotent response while remaining far below any
  // testcase payload size.
  private static readonly MAX_RESULT_BYTES = 64 * 1024;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Starts a write audit entry.  A PENDING entry is created before the caller
   * mutates testcase files.  A unique violation is surfaced as an operation
   * conflict carrying the existing entry for replay/parameter comparison.
   */
  async begin(input: McpAdminAuditBeginInput): Promise<McpAdminAuditLog> {
    this.validateWriteInput(input);

    try {
      return await this.prisma.mcpAdminAuditLog.create({
        data: {
          ...this.toCreateData(input),
          operationId: this.normalizeRequiredText(
            input.operationId,
            'operationId',
            100,
          ),
          success: null,
          completedAt: null,
        },
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const existing = await this.findByActorAndOperationId(
        input.actorUserId,
        input.operationId,
      );
      if (existing) throw new McpAdminAuditOperationConflictError(existing);
      throw error;
    }
  }

  /**
   * Completes a previously-created write with a safe replay result.
   * Repeating completion of an already successful entry is harmless and
   * returns the original result; a failed entry cannot be changed to success.
   */
  async completeSuccess(
    auditId: number | Pick<McpAdminAuditLog, 'id'>,
    resultJson?: unknown,
  ): Promise<McpAdminAuditLog> {
    const id = this.auditId(auditId);
    const existing = await this.findById(id);
    if (!existing)
      throw new McpAdminAuditLifecycleError('Audit entry not found.');
    if (existing.success === true) return existing;
    if (existing.success === false) {
      throw new McpAdminAuditLifecycleError(
        'A failed audit entry cannot be completed successfully.',
      );
    }

    const safeResult = this.sanitizeResultJson(resultJson);
    const data: Prisma.McpAdminAuditLogUpdateInput = {
      success: true,
      completedAt: new Date(),
      errorCode: null,
    };
    if (safeResult !== undefined) data.resultJson = safeResult;

    return this.prisma.mcpAdminAuditLog.update({ where: { id }, data });
  }

  /**
   * Completes a write as FAILED.  Only a stable error code is accepted; raw
   * exception messages and stack traces must never enter the audit table.
   * Repeating completion of an already failed entry is idempotent.
   */
  async completeFailure(
    auditId: number | Pick<McpAdminAuditLog, 'id'>,
    errorCode: string,
  ): Promise<McpAdminAuditLog> {
    const id = this.auditId(auditId);
    const existing = await this.findById(id);
    if (!existing)
      throw new McpAdminAuditLifecycleError('Audit entry not found.');
    if (existing.success === false) return existing;
    if (existing.success === true) {
      throw new McpAdminAuditLifecycleError(
        'A successful audit entry cannot be marked failed.',
      );
    }

    const safeErrorCode = this.normalizeErrorCode(errorCode);
    return this.prisma.mcpAdminAuditLog.update({
      where: { id },
      data: {
        success: false,
        errorCode: safeErrorCode,
        completedAt: new Date(),
      },
    });
  }

  /** Records a successful sensitive read.  Read entries never have operationId. */
  async recordReadSuccess(
    input: McpAdminAuditReadInput,
  ): Promise<McpAdminAuditLog> {
    this.validateReadInput(input);
    return this.prisma.mcpAdminAuditLog.create({
      data: {
        ...this.toCreateData(input),
        operationId: null,
        success: true,
        completedAt: new Date(),
      },
    });
  }

  /** Records a failed sensitive read without persisting raw exception details. */
  async recordReadFailure(
    input: McpAdminAuditReadInput,
    errorCode: string,
  ): Promise<McpAdminAuditLog> {
    this.validateReadInput(input);
    return this.prisma.mcpAdminAuditLog.create({
      data: {
        ...this.toCreateData(input),
        operationId: null,
        success: false,
        errorCode: this.normalizeErrorCode(errorCode),
        completedAt: new Date(),
      },
    });
  }

  /** Fetches one audit entry for replay or operation-parameter comparison. */
  async findByActorAndOperationId(
    actorUserId: number,
    operationId: string,
  ): Promise<McpAdminAuditLog | null> {
    this.validateActorUserId(actorUserId);
    const normalizedOperationId = this.normalizeRequiredText(
      operationId,
      'operationId',
      100,
    );
    return this.prisma.mcpAdminAuditLog.findUnique({
      where: {
        actorUserId_operationId: {
          actorUserId,
          operationId: normalizedOperationId,
        },
      },
    });
  }

  /** Alias kept descriptive for callers implementing idempotent writes. */
  async findWriteByOperationId(
    actorUserId: number,
    operationId: string,
  ): Promise<McpAdminAuditLog | null> {
    return this.findByActorAndOperationId(actorUserId, operationId);
  }

  async findById(id: number): Promise<McpAdminAuditLog | null> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new McpAdminAuditLifecycleError(
        'Audit id must be a positive integer.',
      );
    }
    return this.prisma.mcpAdminAuditLog.findUnique({ where: { id } });
  }

  /** Reads successful audit records, newest first. */
  async findSuccessful(
    query: McpAdminAuditQuery = {},
  ): Promise<McpAdminAuditLog[]> {
    return this.findByOutcome(true, query);
  }

  /** Reads failed audit records, newest first. */
  async findFailed(
    query: McpAdminAuditQuery = {},
  ): Promise<McpAdminAuditLog[]> {
    return this.findByOutcome(false, query);
  }

  async listSuccessful(
    query: McpAdminAuditQuery = {},
  ): Promise<McpAdminAuditLog[]> {
    return this.findSuccessful(query);
  }

  async listFailed(
    query: McpAdminAuditQuery = {},
  ): Promise<McpAdminAuditLog[]> {
    return this.findFailed(query);
  }

  /** Public helper for tests and integration code to verify replay payloads. */
  sanitizeResultJson(resultJson: unknown): Prisma.InputJsonValue | undefined {
    // Replay payloads are always structured objects.  Refuse a free-form
    // string/number/array at the root so a caller cannot accidentally persist
    // testcase text as resultJson.
    if (
      resultJson === undefined ||
      resultJson === null ||
      typeof resultJson !== 'object' ||
      Array.isArray(resultJson)
    ) {
      return undefined;
    }

    const sanitized = this.sanitizeJsonValue(resultJson, 0);
    if (sanitized === undefined) return undefined;

    const serialized = JSON.stringify(sanitized);
    if (!serialized) return undefined;
    if (
      Buffer.byteLength(serialized, 'utf8') >
      McpAdminAuditService.MAX_RESULT_BYTES
    ) {
      throw new McpAdminAuditLifecycleError('Audit result is too large.');
    }

    return sanitized as Prisma.InputJsonValue;
  }

  private async findByOutcome(
    success: boolean,
    query: McpAdminAuditQuery,
  ): Promise<McpAdminAuditLog[]> {
    const where: Prisma.McpAdminAuditLogWhereInput = {
      success,
    };
    if (query.actorUserId !== undefined) {
      this.validateActorUserId(query.actorUserId);
      where.actorUserId = query.actorUserId;
    }
    if (query.problemId !== undefined) {
      this.validatePositiveInteger(query.problemId, 'problemId');
      where.problemId = query.problemId;
    }
    if (query.toolName !== undefined) {
      where.toolName = this.normalizeRequiredText(
        query.toolName,
        'toolName',
        100,
      );
    }
    if (query.action !== undefined) {
      where.action = this.normalizeRequiredText(query.action, 'action', 50);
    }
    if (query.from !== undefined || query.to !== undefined) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lt: query.to } : {}),
      };
    }

    const skip = this.normalizePageNumber(query.skip, 0, 1_000_000);
    const take = this.normalizePageNumber(
      query.take,
      McpAdminAuditService.DEFAULT_TAKE,
      McpAdminAuditService.MAX_TAKE,
    );

    return this.prisma.mcpAdminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
  }

  private toCreateData(input: McpAdminAuditMetadata) {
    this.validateMetadata(input);
    return {
      actorUserId: input.actorUserId,
      actorUsernameSnapshot: this.normalizeOptionalText(
        input.actorUsernameSnapshot,
        'actorUsernameSnapshot',
        50,
      ),
      clientId: this.normalizeOptionalText(input.clientId, 'clientId', 255),
      requestId: this.normalizeOptionalText(input.requestId, 'requestId', 255),
      toolName: this.normalizeRequiredText(input.toolName, 'toolName', 100),
      action: this.normalizeRequiredText(input.action, 'action', 50),
      problemId: this.normalizeOptionalInteger(input.problemId, 'problemId'),
      problemSlugSnapshot: this.normalizeOptionalText(
        input.problemSlugSnapshot,
        'problemSlugSnapshot',
        100,
      ),
      testcaseIndex: this.normalizeOptionalInteger(
        input.testcaseIndex,
        'testcaseIndex',
      ),
      beforeCount: this.normalizeOptionalInteger(
        input.beforeCount,
        'beforeCount',
      ),
      afterCount: this.normalizeOptionalInteger(input.afterCount, 'afterCount'),
      inputBytes: this.normalizeOptionalInteger(input.inputBytes, 'inputBytes'),
      outputBytes: this.normalizeOptionalInteger(
        input.outputBytes,
        'outputBytes',
      ),
      inputSha256: this.normalizeOptionalHash(input.inputSha256, 'inputSha256'),
      outputSha256: this.normalizeOptionalHash(
        input.outputSha256,
        'outputSha256',
      ),
      contentOffset: this.normalizeOptionalInteger(
        input.contentOffset,
        'contentOffset',
      ),
      contentLength: this.normalizeOptionalInteger(
        input.contentLength,
        'contentLength',
      ),
    };
  }

  private validateWriteInput(input: McpAdminAuditBeginInput): void {
    this.validateMetadata(input);
    this.normalizeRequiredText(input.operationId, 'operationId', 100);
  }

  private validateReadInput(input: McpAdminAuditReadInput): void {
    this.validateMetadata(input);
  }

  private validateMetadata(input: McpAdminAuditMetadata): void {
    if (!input || typeof input !== 'object') {
      throw new McpAdminAuditLifecycleError('Audit metadata is required.');
    }
    this.validateActorUserId(input.actorUserId);
    this.normalizeRequiredText(input.toolName, 'toolName', 100);
    this.normalizeRequiredText(input.action, 'action', 50);
  }

  private validateActorUserId(actorUserId: number): void {
    this.validatePositiveInteger(actorUserId, 'actorUserId');
  }

  private validatePositiveInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new McpAdminAuditLifecycleError(
        `${field} must be a positive integer.`,
      );
    }
  }

  private normalizeOptionalInteger(
    value: number | null | undefined,
    field: string,
  ): number | null {
    if (value === undefined || value === null) return null;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new McpAdminAuditLifecycleError(
        `${field} must be a non-negative integer.`,
      );
    }
    return value;
  }

  private normalizeOptionalHash(
    value: string | null | undefined,
    field: string,
  ): string | null {
    if (value === undefined || value === null || value === '') return null;
    const normalized = this.normalizeRequiredText(value, field, 64);
    if (!/^[a-f0-9]{64}$/i.test(normalized)) {
      throw new McpAdminAuditLifecycleError(`${field} must be a SHA-256 hash.`);
    }
    return normalized.toLowerCase();
  }

  private normalizeOptionalText(
    value: string | null | undefined,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) return null;
    return this.normalizeRequiredText(value, field, maxLength);
  }

  private normalizeRequiredText(
    value: string,
    field: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string') {
      throw new McpAdminAuditLifecycleError(`${field} must be a string.`);
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
      throw new McpAdminAuditLifecycleError(`${field} is invalid.`);
    }
    return normalized;
  }

  private normalizeErrorCode(errorCode: string): string {
    const normalized = this.normalizeRequiredText(errorCode, 'errorCode', 100);
    if (!/^[A-Za-z0-9_:-]+$/.test(normalized)) {
      return 'INTERNAL_ERROR';
    }
    return normalized.slice(0, 100).toUpperCase();
  }

  private normalizePageNumber(
    value: number | undefined,
    fallback: number,
    max: number,
  ): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < 0 || value > max) {
      throw new McpAdminAuditLifecycleError(
        'Audit page parameters are invalid.',
      );
    }
    return value;
  }

  private auditId(value: number | Pick<McpAdminAuditLog, 'id'>): number {
    const id = typeof value === 'number' ? value : value?.id;
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new McpAdminAuditLifecycleError(
        'Audit id must be a positive integer.',
      );
    }
    return id;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }

  /**
   * Keep only the small, documented shape of an idempotent MCP response.
   * Unknown keys are dropped, and sensitive-looking keys are always rejected.
   */
  private sanitizeJsonValue(value: unknown, depth: number): unknown {
    if (depth > 8 || value === undefined || typeof value === 'function') {
      return undefined;
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number')
      return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string') {
      return value.length <= 512 ? value : value.slice(0, 512);
    }
    if (Array.isArray(value)) {
      return value
        .slice(0, 1_000)
        .map((item) => this.sanitizeJsonValue(item, depth + 1))
        .filter((item) => item !== undefined);
    }
    if (typeof value !== 'object') return undefined;

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!this.isSafeResultKey(key)) continue;
      const sanitized = this.sanitizeJsonValue(item, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }

  private isSafeResultKey(key: string): boolean {
    if (
      /(?:input|output|content|body|payload|token|secret|password|authorization|cookie|path|file|stack|trace|exception|credential|bearer)/i.test(
        key,
      )
    ) {
      return false;
    }
    return /^(problem|id|slug|title|addedIndex|deletedIndex|testcaseCount|previousRevision|revision|replayed|renumbered|from|to|warning|status|ok|index|count|beforeCount|afterCount|success)$/i.test(
      key,
    );
  }
}
