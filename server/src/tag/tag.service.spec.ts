import { PrismaService } from '../prisma/prisma.service';
import { TagService } from './tag.service';

describe('TagService public queries', () => {
  it('filters both tag visibility and counts by public problems', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { name: 'dynamic-programming', _count: { problems: 12 } },
      ]);
    const prisma = { tag: { findMany } } as unknown as PrismaService;
    const service = new TagService(prisma);

    await expect(service.findPublicTags(' dynamic ')).resolves.toEqual([
      { name: 'dynamic-programming', problemCount: 12 },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: 'dynamic' },
        problems: {
          some: { problem: { isPublic: true } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        _count: {
          select: {
            problems: {
              where: { problem: { isPublic: true } },
            },
          },
        },
      },
    });
  });

  it('does not add a name filter when no keyword is provided', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { tag: { findMany } } as unknown as PrismaService;
    const service = new TagService(prisma);

    await service.findPublicTags();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          problems: {
            some: { problem: { isPublic: true } },
          },
        },
      }),
    );
  });
});
