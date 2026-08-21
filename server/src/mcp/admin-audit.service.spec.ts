import { PrismaService } from '../prisma/prisma.service';
import {
  McpAdminAuditOperationConflictError,
  McpAdminAuditService,
} from './admin-audit.service';

const sha256 = 'a'.repeat(64);

type AuditCreateArgs = { data: Record<string, unknown> };
type AuditFindUniqueArgs = { where: Record<string, unknown> };
type AuditFindManyArgs = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, string>>;
  skip: number;
  take: number;
};
type AuditUpdateArgs = {
  where: { id: number };
  data: Record<string, unknown>;
};

type AuditModelMocks = {
  create: jest.Mock<unknown, [AuditCreateArgs]>;
  findUnique: jest.Mock<unknown, [AuditFindUniqueArgs]>;
  findMany: jest.Mock<unknown, [AuditFindManyArgs]>;
  update: jest.Mock<unknown, [AuditUpdateArgs]>;
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    actorUserId: 7,
    actorUsernameSnapshot: 'admin',
    clientId: 'client-1',
    requestId: 'request-1',
    operationId: 'operation-1',
    toolName: 'add_problem_testcase',
    action: 'ADD_TESTCASE',
    problemId: 12,
    problemSlugSnapshot: 'p12',
    testcaseIndex: 3,
    beforeCount: 2,
    afterCount: 3,
    inputBytes: 10,
    outputBytes: 20,
    inputSha256: sha256,
    outputSha256: sha256,
    contentOffset: null,
    contentLength: null,
    success: null,
    errorCode: null,
    resultJson: null,
    createdAt: new Date('2026-08-21T00:00:00.000Z'),
    completedAt: null,
    ...overrides,
  };
}

describe('McpAdminAuditService', () => {
  let prisma: {
    mcpAdminAuditLog: AuditModelMocks;
  };
  let service: McpAdminAuditService;

  beforeEach(() => {
    prisma = {
      mcpAdminAuditLog: {
        create: jest.fn<unknown, [AuditCreateArgs]>(),
        findUnique: jest.fn<unknown, [AuditFindUniqueArgs]>(),
        findMany: jest.fn<unknown, [AuditFindManyArgs]>().mockResolvedValue([]),
        update: jest.fn<unknown, [AuditUpdateArgs]>(),
      },
    };
    service = new McpAdminAuditService(prisma as unknown as PrismaService);
  });

  it('creates a PENDING write before mutation and uses the composite lookup key', async () => {
    const pending = record();
    prisma.mcpAdminAuditLog.create.mockResolvedValue(pending);

    const result = await service.begin({
      actorUserId: 7,
      actorUsernameSnapshot: 'admin',
      clientId: 'client-1',
      requestId: 'request-1',
      operationId: 'operation-1',
      toolName: 'add_problem_testcase',
      action: 'ADD_TESTCASE',
      problemId: 12,
      problemSlugSnapshot: 'p12',
      beforeCount: 2,
      inputBytes: 10,
      outputBytes: 20,
      inputSha256: sha256,
      outputSha256: sha256,
    });

    expect(result).toBe(pending);
    const createData = prisma.mcpAdminAuditLog.create.mock.calls[0][0].data;
    expect(createData.actorUserId).toBe(7);
    expect(createData.operationId).toBe('operation-1');
    expect(createData.success).toBeNull();
    expect(createData.completedAt).toBeNull();
    expect(createData).not.toHaveProperty('input');
    expect(createData).not.toHaveProperty('expectedOutput');
  });

  it('records reads with no operation id and records success/failure outcomes', async () => {
    const successful = record({ operationId: null, success: true });
    const failed = record({
      operationId: null,
      success: false,
      errorCode: 'INTERNAL_ERROR',
    });
    prisma.mcpAdminAuditLog.create
      .mockResolvedValueOnce(successful)
      .mockResolvedValueOnce(failed);

    await service.recordReadSuccess({
      actorUserId: 7,
      toolName: 'get_problem_testcase',
      action: 'READ_TESTCASE',
      problemId: 12,
      testcaseIndex: 1,
      inputBytes: 10,
      outputBytes: 20,
      inputSha256: sha256,
      outputSha256: sha256,
      contentOffset: 0,
      contentLength: 10,
    });
    await service.recordReadFailure(
      {
        actorUserId: 7,
        toolName: 'get_problem_testcase',
        action: 'READ_TESTCASE',
        problemId: 12,
      },
      'internal_error',
    );

    const successfulData = prisma.mcpAdminAuditLog.create.mock.calls[0][0].data;
    const failedData = prisma.mcpAdminAuditLog.create.mock.calls[1][0].data;
    expect(successfulData.operationId).toBeNull();
    expect(successfulData.success).toBe(true);
    expect(failedData.operationId).toBeNull();
    expect(failedData.success).toBe(false);
    expect(failedData.errorCode).toBe('INTERNAL_ERROR');
  });

  it('completes success with a sanitized replay result and never stores testcase content', async () => {
    const pending = record();
    const completed = record({
      success: true,
      resultJson: {
        problem: { id: 12, slug: 'p12' },
        addedIndex: 3,
        revision: 'next-revision',
        replayed: false,
      },
    });
    prisma.mcpAdminAuditLog.findUnique.mockResolvedValueOnce(pending);
    prisma.mcpAdminAuditLog.update.mockResolvedValue(completed);

    await service.completeSuccess(1, {
      problem: { id: 12, slug: 'p12', title: 'Safe title' },
      addedIndex: 3,
      revision: 'next-revision',
      replayed: false,
      input: 'hidden input must not be persisted',
      expectedOutput: 'hidden output must not be persisted',
      filePath: 'C:\\private\\problems\\p12',
      accessToken: 'bearer-token',
    });

    const updateData = prisma.mcpAdminAuditLog.update.mock.calls[0][0].data;
    expect(updateData.success).toBe(true);
    expect(updateData.resultJson).toEqual({
      problem: { id: 12, slug: 'p12', title: 'Safe title' },
      addedIndex: 3,
      revision: 'next-revision',
      replayed: false,
    });
    expect(JSON.stringify(updateData.resultJson)).not.toContain('hidden input');
    expect(JSON.stringify(updateData.resultJson)).not.toContain('bearer-token');
  });

  it('completes failure with only a normalized error code', async () => {
    const pending = record();
    prisma.mcpAdminAuditLog.findUnique.mockResolvedValue(pending);
    prisma.mcpAdminAuditLog.update.mockResolvedValue(
      record({ success: false, errorCode: 'REVISION_CONFLICT' }),
    );

    await service.completeFailure(1, 'revision_conflict');

    const updateData = prisma.mcpAdminAuditLog.update.mock.calls[0][0].data;
    expect(updateData.success).toBe(false);
    expect(updateData.errorCode).toBe('REVISION_CONFLICT');
    expect(updateData).not.toHaveProperty('errorMessage');
  });

  it('does not persist a free-form root result that could contain testcase text', () => {
    expect(
      service.sanitizeResultJson('raw hidden testcase text'),
    ).toBeUndefined();
    expect(
      service.sanitizeResultJson(['raw hidden testcase text']),
    ).toBeUndefined();
  });

  it('returns the existing write entry for replay/conflict comparison after a unique race', async () => {
    const existing = record({ success: true });
    prisma.mcpAdminAuditLog.create.mockRejectedValue({ code: 'P2002' });
    prisma.mcpAdminAuditLog.findUnique.mockResolvedValue(existing);

    await expect(
      service.begin({
        actorUserId: 7,
        operationId: 'operation-1',
        toolName: 'add_problem_testcase',
        action: 'ADD_TESTCASE',
      }),
    ).rejects.toBeInstanceOf(McpAdminAuditOperationConflictError);
    expect(prisma.mcpAdminAuditLog.findUnique).toHaveBeenCalledWith({
      where: {
        actorUserId_operationId: {
          actorUserId: 7,
          operationId: 'operation-1',
        },
      },
    });
  });

  it('queries successful and failed records separately with bounded pagination', async () => {
    await service.findSuccessful({ actorUserId: 7, take: 20 });
    await service.findFailed({ problemId: 12, skip: 5, take: 10 });

    expect(prisma.mcpAdminAuditLog.findMany).toHaveBeenNthCalledWith(1, {
      where: { success: true, actorUserId: 7 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(prisma.mcpAdminAuditLog.findMany).toHaveBeenNthCalledWith(2, {
      where: { success: false, problemId: 12 },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 5,
      take: 10,
    });
  });
});
