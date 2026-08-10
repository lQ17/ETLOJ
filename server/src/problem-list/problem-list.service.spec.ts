/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
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
