/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { SubmissionService } from './submission.service';

describe('SubmissionService MCP personal read isolation', () => {
  const prisma = {
    problem: { findMany: jest.fn() },
    submission: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  };
  const service = Object.create(
    SubmissionService.prototype,
  ) as SubmissionService;
  (service as unknown as { prisma: typeof prisma }).prisma = prisma;

  beforeEach(() => jest.clearAllMocks());

  it('returns all three statuses only for validated public problems', async () => {
    prisma.problem.findMany.mockResolvedValue([
      { id: 1, slug: 'a', title: 'A' },
      { id: 2, slug: 'b', title: 'B' },
      { id: 3, slug: 'c', title: 'C' },
    ]);
    prisma.submission.findMany.mockResolvedValue([
      { problemId: 1, status: 'WA' },
      { problemId: 2, status: 'AC' },
    ]);
    const result = await service.getMyPublicProblemStatus(7, [1, 2, 3]);
    expect(prisma.problem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [1, 2, 3] }, isPublic: true },
      }),
    );
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, problemId: { in: [1, 2, 3] } },
      }),
    );
    expect(result.map((item) => item.status)).toEqual([
      'ATTEMPTED',
      'AC',
      'UNATTEMPTED',
    ]);
  });

  it('does not distinguish a hidden problem from a missing problem', async () => {
    prisma.problem.findMany.mockResolvedValue([]);
    await expect(service.getMyPublicProblemStatus(7, [88])).rejects.toEqual(
      expect.any(NotFoundException),
    );
    await expect(service.getMyPublicProblemStatus(7, [404])).rejects.toEqual(
      expect.any(NotFoundException),
    );
  });

  it('forces user and public-problem filters and returns summaries without code', async () => {
    prisma.submission.findMany.mockResolvedValue([]);
    prisma.submission.count.mockResolvedValue(0);
    await service.listMyPublicSubmissions(7, { page: 1, pageSize: 20 });
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7,
          problem: { isPublic: true },
        }),
        select: expect.not.objectContaining({
          code: expect.anything(),
          userId: expect.anything(),
          user: expect.anything(),
        }),
      }),
    );
  });

  it('enforces ownership in the detail query even for privileged roles and omits source code', async () => {
    prisma.submission.findFirst.mockResolvedValue({
      id: 9,
      code: 'secret source',
      language: 'cpp',
      status: 'AC',
      createdAt: new Date(),
      problem: { id: 1, slug: 'a', title: 'A' },
    });
    const result = await service.getMyPublicSubmission(7, 9);
    expect(prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9, userId: 7, problem: { isPublic: true } },
      }),
    );
    expect(result).not.toHaveProperty('code');
    expect(result.codeSize).toBe(Buffer.byteLength('secret source'));
  });

  it('returns the same safe error for another user and a missing submission', async () => {
    prisma.submission.findFirst.mockResolvedValue(null);
    await expect(service.getMyPublicSubmission(7, 9)).rejects.toEqual(
      expect.any(NotFoundException),
    );
    await expect(service.getMyPublicSubmission(7, 404)).rejects.toEqual(
      expect.any(NotFoundException),
    );
  });
});
