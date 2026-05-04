import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProblemListDto } from "./dto/create-problem-list.dto";
import { UpdateProblemListDto } from "./dto/update-problem-list.dto";

@Injectable()
export class ProblemListService {
  constructor(private prisma: PrismaService) {}

  async findAllPublic(page = 1, pageSize = 20, keyword?: string) {
    const where: any = { isPublic: true };
    if (keyword) {
      where.title = { contains: keyword };
    }
    const [items, total] = await Promise.all([
      this.prisma.problemList.findMany({
        where,
        include: {
          creator: { select: { id: true, username: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.problemList.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findAllByUser(userId: number, page = 1, pageSize = 20) {
    const where = { creatorId: userId };
    const [items, total] = await Promise.all([
      this.prisma.problemList.findMany({
        where,
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.problemList.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: number, userId?: number, userRole?: string) {
    const list = await this.prisma.problemList.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            problem: {
              select: { id: true, slug: true, title: true, difficulty: true, score: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        creator: { select: { id: true, username: true } },
      },
    });
    if (!list) {
      throw new NotFoundException("题单不存在");
    }
    if (!list.isPublic) {
      if (!userId || (list.creatorId !== userId && userRole !== "ADMIN" && userRole !== "TEACHER")) {
        throw new ForbiddenException("无权访问该题单");
      }
    }
    return list;
  }

  async create(userId: number, dto: CreateProblemListDto) {
    return this.prisma.problemList.create({
      data: {
        title: dto.title,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        creatorId: userId,
      },
    });
  }

  async update(id: number, userId: number, userRole: string, dto: UpdateProblemListDto) {
    const list = await this.prisma.problemList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException("题单不存在");
    if (list.isPublic) {
      if (userRole !== "ADMIN" && userRole !== "TEACHER") {
        throw new ForbiddenException("仅管理员和教师可编辑公共题单");
      }
    } else {
      if (list.creatorId !== userId) {
        throw new ForbiddenException("仅创建者可编辑该题单");
      }
    }
    return this.prisma.problemList.update({ where: { id }, data: dto });
  }

  async delete(id: number, userId: number, userRole: string) {
    const list = await this.prisma.problemList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException("题单不存在");
    if (list.isPublic) {
      if (userRole !== "ADMIN" && userRole !== "TEACHER") {
        throw new ForbiddenException("仅管理员和教师可删除公共题单");
      }
    } else {
      if (list.creatorId !== userId) {
        throw new ForbiddenException("仅创建者可删除该题单");
      }
    }
    return this.prisma.problemList.delete({ where: { id } });
  }

  async addItems(listId: number, problemIds: number[]) {
    const list = await this.prisma.problemList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException("题单不存在");
    const maxSort = await this.prisma.problemListItem.aggregate({
      where: { listId },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;
    const results: any[] = [];
    for (const problemId of problemIds) {
      const existing = await this.prisma.problemListItem.findUnique({
        where: { listId_problemId: { listId, problemId } },
      });
      if (existing) continue;
      const item = await this.prisma.problemListItem.create({
        data: { listId, problemId, sortOrder: nextSort++ },
      });
      results.push(item);
    }
    return results;
  }

  async removeItem(listId: number, problemId: number) {
    const item = await this.prisma.problemListItem.findUnique({
      where: { listId_problemId: { listId, problemId } },
    });
    if (!item) throw new NotFoundException("题目不在该题单中");
    return this.prisma.problemListItem.delete({
      where: { listId_problemId: { listId, problemId } },
    });
  }

  async updateSortOrder(listId: number, items: { id: number; sortOrder: number }[]) {
    const list = await this.prisma.problemList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException("题单不存在");
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.problemListItem.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }
}
