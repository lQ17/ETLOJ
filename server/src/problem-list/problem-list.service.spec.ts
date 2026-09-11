/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProblemListService } from './problem-list.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProblemListService MCP safe queries', () => {
  const prisma = {
    problemList: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const service = new ProblemListService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('counts only public related problems in public list pagination', async () => {
    prisma.problemList.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'A',
        description: null,
        createdAt: new Date(),
        _count: { items: 2 },
      },
    ]);
    prisma.problemList.count.mockResolvedValue(1);
    const result = await service.findAllPublicForMcp(1, 20, 'A');
    expect(prisma.problemList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: true, title: { contains: 'A' } },
        select: expect.objectContaining({
          _count: {
            select: { items: { where: { problem: { isPublic: true } } } },
          },
        }),
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({ problemCount: 2 }),
    );
  });

  it('filters hidden problems and renumbers visible items without leaking sort gaps', async () => {
    prisma.problemList.findFirst.mockResolvedValue({
      id: 1,
      title: 'A',
      description: null,
      items: [
        {
          problem: {
            id: 10,
            slug: 'a',
            title: 'A',
            difficulty: 'IRON',
            score: 10,
            problemTags: [],
          },
        },
        {
          problem: {
            id: 30,
            slug: 'c',
            title: 'C',
            difficulty: 'SILVER',
            score: 35,
            problemTags: [{ tag: { name: 'dp' } }],
          },
        },
      ],
    });
    const result = await service.findOnePublicForMcp(1);
    expect(prisma.problemList.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, isPublic: true },
        select: expect.objectContaining({
          items: expect.objectContaining({
            where: { problem: { isPublic: true } },
          }),
        }),
      }),
    );
    expect(result.items.map((item) => item.order)).toEqual([1, 2]);
    expect(result.problemCount).toBe(2);
    expect(JSON.stringify(result)).not.toContain('sortOrder');
  });

  it('makes private and missing lists indistinguishable', async () => {
    prisma.problemList.findFirst.mockResolvedValue(null);
    await expect(service.findOnePublicForMcp(9)).rejects.toEqual(
      expect.any(NotFoundException),
    );
    await expect(service.findOnePublicForMcp(404)).rejects.toEqual(
      expect.any(NotFoundException),
    );
  });
});

describe('ProblemListService web permissions and visibility', () => {
  const prisma = {
    problemList: {
      findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(),
      create: jest.fn(), update: jest.fn(),
    },
    problem: { findUnique: jest.fn() },
    problemListItem: { aggregate: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };
  const service = new ProblemListService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('rejects student public creation and private-to-public updates before writing', async () => {
    await expect(service.create(1, { title: 'A', isPublic: true }, 'STUDENT'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.problemList.create).not.toHaveBeenCalled();
    prisma.problemList.findUnique.mockResolvedValue({ creatorId: 1, isPublic: false });
    await expect(service.update(1, 1, 'STUDENT', { isPublic: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.problemList.update).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'TEACHER'])('allows %s to create public lists', async (role) => {
    await service.create(1, { title: 'A', isPublic: true }, role);
    expect(prisma.problemList.create).toHaveBeenCalledWith({
      data: { title: 'A', description: undefined, isPublic: true, creatorId: 1 },
    });
  });

  it('keeps student private creation available', async () => {
    await service.create(1, { title: 'A' }, 'STUDENT');
    expect(prisma.problemList.create).toHaveBeenCalledWith({
      data: { title: 'A', description: undefined, isPublic: false, creatorId: 1 },
    });
  });

  it.each([undefined, 'STUDENT', 'ADMIN', 'TEACHER'])('uses matching count and AC visibility for %s', async (role) => {
    const privileged = role === 'ADMIN' || role === 'TEACHER';
    prisma.problemList.findMany.mockImplementation(async () => [{ id: 7, _count: { items: 2 } }]);
    prisma.problemList.count.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ list_id: 7, cnt: BigInt(1) }]);
    for (const result of [
      await service.findAllPublic(1, 20, undefined, 1, role),
      await service.findAllByUser(1, 1, 20, role),
    ]) {
      expect(result.items[0]).toEqual(expect.objectContaining({ acCount: 1 }));
    }
    for (const [query] of prisma.problemList.findMany.mock.calls) {
      expect(query.include._count.select.items.where).toEqual(privileged ? {} : { problem: { isPublic: true } });
    }
    for (const [sql, userId, listId] of prisma.$queryRawUnsafe.mock.calls) {
      expect(sql.includes('AND p.is_public = true')).toBe(!privileged);
      expect([userId, listId]).toEqual([1, 7]);
    }
  });

  it.each([undefined, 'STUDENT', 'ADMIN', 'TEACHER'])('filters detail for %s according to problem permissions', async (role) => {
    prisma.problemList.findUnique.mockResolvedValue({ isPublic: true, items: [] });
    await service.findOne(7, 1, role);
    expect(prisma.problemList.findUnique.mock.calls[0][0].include.items.where)
      .toEqual(role === 'ADMIN' || role === 'TEACHER' ? {} : { problem: { isPublic: true } });
  });

  it('rejects access to another student private list', async () => {
    prisma.problemList.findUnique.mockResolvedValue({ isPublic: false, creatorId: 2 });
    await expect(service.findOne(7, 1, 'STUDENT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats hidden and missing problems identically when students add items', async () => {
    prisma.problemList.findUnique.mockResolvedValue({ id: 7 });
    prisma.problemListItem.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    prisma.problem.findUnique.mockResolvedValueOnce({ id: 10, isPublic: false }).mockResolvedValueOnce(null);
    await expect(service.addItems(7, ['hidden', 'missing'], 'STUDENT'))
      .resolves.toEqual({ added: [], errors: ['hidden', 'missing'] });
    expect(prisma.problemListItem.create).not.toHaveBeenCalled();
  });
});
