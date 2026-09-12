import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CategoryFieldsDto, CreateCategoryDto } from "./dto/category.dto";

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async initialize() {
    const defaults = [
      { name: "系统学习", description: "按学习顺序逐步掌握编程与算法", children: ["编程入门", "基础算法", "进阶算法", "数据结构"] },
      { name: "竞赛考级", description: "按竞赛与考级方向组织练习", children: ["GESP", "CSP-J", "CSP-S", "NOIP"] },
      { name: "教材配套", description: "配合课堂实际使用的教材练习", children: [] as string[] },
      { name: "专题训练", description: "围绕薄弱环节开展针对性训练", children: ["基础巩固", "综合训练", "易错题精选"] },
    ];
    return this.prisma.$transaction(async tx => {
      if (await tx.problemListCategory.count()) throw new BadRequestException("已有分类，请直接在后台维护");
      for (const [sortOrder, category] of defaults.entries()) {
        await tx.problemListCategory.create({ data: {
          name: category.name, description: category.description, sortOrder,
          children: { create: category.children.map((name, index) => ({ name, sortOrder: index })) },
        } });
      }
      return { success: true };
    }, { isolationLevel: "Serializable" });
  }

  async tree(management = false) {
    const rows = await this.prisma.problemListCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { items: { where: { list: { isPublic: true } } } } } },
    });
    return rows.filter(row => row.parentId === null && (management || row.enabled)).map(root => ({
      ...root,
      children: rows.filter(row => row.parentId === root.id && (management || row.enabled)),
    }));
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId != null) {
      const parent = await this.prisma.problemListCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.parentId !== null) throw new BadRequestException("只能在一级栏目下创建二级分类");
    }
    return this.prisma.problemListCategory.create({ data: dto });
  }

  async update(id: number, dto: CategoryFieldsDto) {
    if (!await this.prisma.problemListCategory.findUnique({ where: { id } })) throw new NotFoundException("分类不存在");
    return this.prisma.problemListCategory.update({ where: { id }, data: dto });
  }

  private async assertLeaf(id: number) {
    const category = await this.prisma.problemListCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("分类不存在");
    if (category.parentId === null) throw new BadRequestException("请在二级分类中编排题单");
  }

  async items(id: number) {
    await this.assertLeaf(id);
    return this.prisma.problemListCategoryItem.findMany({
      where: { categoryId: id }, orderBy: [{ sortOrder: "asc" }, { listId: "asc" }],
      include: { list: { select: { id: true, title: true, isPublic: true } } },
    });
  }

  async add(id: number, listIds: number[]) {
    await this.assertLeaf(id);
    return this.prisma.$transaction(async tx => {
      const count = await tx.problemList.count({ where: { id: { in: listIds }, isPublic: true } });
      if (count !== listIds.length) throw new BadRequestException("只能归类存在的公共题单");
      const max = await tx.problemListCategoryItem.aggregate({ where: { categoryId: id }, _max: { sortOrder: true } });
      return tx.problemListCategoryItem.createMany({
        data: listIds.map((listId, index) => ({ categoryId: id, listId, sortOrder: (max._max.sortOrder ?? -1) + index + 1 })),
        skipDuplicates: true,
      });
    });
  }

  async remove(id: number, listId: number) {
    await this.assertLeaf(id);
    await this.prisma.problemListCategoryItem.deleteMany({ where: { categoryId: id, listId } });
    return { success: true };
  }

  async sort(id: number, listIds: number[]) {
    await this.assertLeaf(id);
    return this.prisma.$transaction(async tx => {
      const existing = await tx.problemListCategoryItem.findMany({ where: { categoryId: id }, select: { listId: true } });
      const ids = new Set(listIds);
      if (ids.size !== listIds.length || existing.length !== listIds.length || existing.some(item => !ids.has(item.listId))) {
        throw new BadRequestException("分类内容已变化，请刷新后重新排序");
      }
      for (const [sortOrder, listId] of listIds.entries()) {
        await tx.problemListCategoryItem.update({ where: { categoryId_listId: { categoryId: id, listId } }, data: { sortOrder } });
      }
      return { success: true };
    });
  }
}
