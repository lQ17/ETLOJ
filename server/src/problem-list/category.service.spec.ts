import { BadRequestException } from "@nestjs/common";
import { CategoryService } from "./category.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CategoryService", () => {
  const prisma = {
    problemListCategory: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    problemList: { count: jest.fn() },
    problemListCategoryItem: { findMany: jest.fn(), aggregate: jest.fn(), createMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CategoryService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(callback => callback(prisma));
  });

  it("hides disabled roots and descendants, but retains them for management", async () => {
    prisma.problemListCategory.findMany.mockResolvedValue([
      { id: 1, parentId: null, enabled: true }, { id: 2, parentId: 1, enabled: true },
      { id: 3, parentId: 1, enabled: false }, { id: 4, parentId: null, enabled: false },
      { id: 5, parentId: 4, enabled: true },
    ]);
    expect(await service.tree()).toEqual([{ id: 1, parentId: null, enabled: true, children: [{ id: 2, parentId: 1, enabled: true }] }]);
    const admin = await service.tree(true);
    expect(admin).toHaveLength(2);
    expect(admin[0].children).toHaveLength(2);
    expect(admin[1].children).toHaveLength(1);
  });

  it("rejects third-level and missing parents", async () => {
    prisma.problemListCategory.findUnique.mockResolvedValueOnce({ parentId: 1 }).mockResolvedValueOnce(null);
    await expect(service.create({ name: "nested", parentId: 2 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ name: "missing", parentId: 999 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.problemListCategory.create).not.toHaveBeenCalled();
  });

  it("rejects assigning lists directly to a root", async () => {
    prisma.problemListCategory.findUnique.mockResolvedValue({ parentId: null });
    await expect(service.add(1, [1])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.problemListCategoryItem.createMany).not.toHaveBeenCalled();
  });

  it("rejects batches containing private or missing lists without a partial write", async () => {
    prisma.problemListCategory.findUnique.mockResolvedValue({ parentId: 1 });
    prisma.problemList.count.mockResolvedValue(1);
    await expect(service.add(2, [1, 2])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.problemListCategoryItem.createMany).not.toHaveBeenCalled();
  });

  it("appends memberships and preserves existing memberships on duplicate addition", async () => {
    prisma.problemListCategory.findUnique.mockResolvedValue({ parentId: 1 });
    prisma.problemList.count.mockResolvedValue(2);
    prisma.problemListCategoryItem.aggregate.mockResolvedValue({ _max: { sortOrder: 7 } });
    await service.add(2, [10, 11]);
    expect(prisma.problemListCategoryItem.createMany).toHaveBeenCalledWith({
      data: [{ categoryId: 2, listId: 10, sortOrder: 8 }, { categoryId: 2, listId: 11, sortOrder: 9 }], skipDuplicates: true,
    });
  });

  it.each([[10], [10, 10], [10, 99]])("rejects incomplete, duplicate or foreign sort IDs: %j", async (...ids) => {
    prisma.problemListCategory.findUnique.mockResolvedValue({ parentId: 1 });
    prisma.problemListCategoryItem.findMany.mockResolvedValue([{ listId: 10 }, { listId: 11 }]);
    await expect(service.sort(2, ids)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.problemListCategoryItem.update).not.toHaveBeenCalled();
  });

  it("persists each list position only within the requested category", async () => {
    prisma.problemListCategory.findUnique.mockResolvedValue({ parentId: 1 });
    prisma.problemListCategoryItem.findMany.mockResolvedValue([{ listId: 10 }, { listId: 11 }]);
    await service.sort(2, [11, 10]);
    expect(prisma.problemListCategoryItem.update.mock.calls).toEqual([
      [{ where: { categoryId_listId: { categoryId: 2, listId: 11 } }, data: { sortOrder: 0 } }],
      [{ where: { categoryId_listId: { categoryId: 2, listId: 10 } }, data: { sortOrder: 1 } }],
    ]);
  });
});
