import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProblemListDto } from "./dto/create-problem-list.dto";
import { UpdateProblemListDto } from "./dto/update-problem-list.dto";

@Injectable()
export class ProblemListService {
  constructor(private prisma: PrismaService) {}

  private async getAcCounts(userId: number, listIds: number[]): Promise<Record<number, number>> {
    if (!userId || listIds.length === 0) return {};
    const rows: { list_id: number; cnt: number }[] = await this.prisma.$queryRawUnsafe(
      `SELECT pli.list_id, COUNT(DISTINCT pli.problem_id) AS cnt
       FROM problem_list_items pli
       JOIN submissions s ON s.problem_id = pli.problem_id AND s.user_id = %d AND s.status = 'AC'
       WHERE pli.list_id IN (${listIds.join(",")})
       GROUP BY pli.list_id`,
      userId,
    );
    const map: Record<number, number> = {};
    for (const r of rows) map[r.list_id] = Number(r.cnt);
    return map;
  }

  async findAllPublic(page = 1, pageSize = 20, keyword?: string, userId?: number) {
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
    if (userId && items.length > 0) {
      const acMap = await this.getAcCounts(userId, items.map((i) => i.id));
      for (const item of items) (item as any).acCount = acMap[item.id] ?? 0;
    }
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
    if (items.length > 0) {
      const acMap = await this.getAcCounts(userId, items.map((i) => i.id));
      for (const item of items) (item as any).acCount = acMap[item.id] ?? 0;
    }
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
    const isAdminOrTeacher = userRole === "ADMIN" || userRole === "TEACHER";
    if (list.isPublic && !isAdminOrTeacher) {
      throw new ForbiddenException("仅管理员和教师可编辑公共题单");
    }
    if (!list.isPublic && list.creatorId !== userId && !isAdminOrTeacher) {
      throw new ForbiddenException("仅创建者可编辑该题单");
    }
    return this.prisma.problemList.update({ where: { id }, data: dto });
  }

  async delete(id: number, userId: number, userRole: string) {
    const list = await this.prisma.problemList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException("题单不存在");
    const isAdminOrTeacher = userRole === "ADMIN" || userRole === "TEACHER";
    if (list.isPublic && !isAdminOrTeacher) {
      throw new ForbiddenException("仅管理员和教师可删除公共题单");
    }
    if (!list.isPublic && list.creatorId !== userId && !isAdminOrTeacher) {
      throw new ForbiddenException("仅创建者可删除该题单");
    }
    return this.prisma.problemList.delete({ where: { id } });
  }

  async addItems(listId: number, slugs: string[]) {
    const list = await this.prisma.problemList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException("题单不存在");
    const maxSort = await this.prisma.problemListItem.aggregate({
      where: { listId },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;
    const results: any[] = [];
    const errors: string[] = [];
    for (const slug of slugs) {
      const problem = await this.prisma.problem.findUnique({ where: { slug } });
      if (!problem) { errors.push(slug); continue; }
      const existing = await this.prisma.problemListItem.findUnique({
        where: { listId_problemId: { listId, problemId: problem.id } },
      });
      if (existing) continue;
      const item = await this.prisma.problemListItem.create({
        data: { listId, problemId: problem.id, sortOrder: nextSort++ },
      });
      results.push(item);
    }
    return { added: results, errors };
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
    const listItems = await this.prisma.problemListItem.findMany({
      where: { listId },
      select: { id: true },
    });
    const validIds = new Set(listItems.map((i) => i.id));
    const invalid = items.filter((i) => !validIds.has(i.id));
    if (invalid.length > 0) {
      throw new ForbiddenException("部分题目不属于该题单");
    }
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
