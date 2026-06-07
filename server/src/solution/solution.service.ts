import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { SolutionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSolutionDto } from "./dto/create-solution.dto";
import { UpdateSolutionDto } from "./dto/update-solution.dto";

@Injectable()
export class SolutionService {
  constructor(private prisma: PrismaService) {}

  async findByProblem(problemId: number) {
    return this.prisma.solution.findMany({
      where: { problemId, status: SolutionStatus.APPROVED },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async findByAuthor(authorId: number) {
    return this.prisma.solution.findMany({
      where: { authorId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        problem: { select: { id: true, slug: true, title: true } },
      },
    });
  }

  async findOne(id: number) {
    const solution = await this.prisma.solution.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
    if (!solution) throw new NotFoundException("题解不存在");
    return solution;
  }

  async create(authorId: number, dto: CreateSolutionDto) {
    return this.prisma.solution.create({
      data: {
        problemId: dto.problemId,
        authorId,
        content: dto.content,
        status: SolutionStatus.PENDING,
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async update(id: number, userId: number, userRole: string, dto: UpdateSolutionDto) {
    const solution = await this.findOne(id);
    if (solution.authorId !== userId && userRole !== "ADMIN") {
      throw new ForbiddenException("只能修改自己的题解");
    }
    if (solution.status === SolutionStatus.APPROVED) {
      throw new ForbiddenException("已通过的题解不可修改");
    }
    return this.prisma.solution.update({
      where: { id },
      data: { content: dto.content, status: SolutionStatus.PENDING, rejectReason: null },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    const solution = await this.findOne(id);
    if (solution.authorId !== userId && userRole !== "ADMIN") {
      throw new ForbiddenException("只能删除自己的题解");
    }
    return this.prisma.solution.delete({ where: { id } });
  }

  async approve(id: number) {
    await this.findOne(id);
    return this.prisma.solution.update({
      where: { id },
      data: { status: SolutionStatus.APPROVED, rejectReason: null },
    });
  }

  async reject(id: number, reason: string) {
    await this.findOne(id);
    return this.prisma.solution.update({
      where: { id },
      data: { status: SolutionStatus.REJECTED, rejectReason: reason },
    });
  }

  async findPending() {
    return this.prisma.solution.findMany({
      where: { status: SolutionStatus.PENDING },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        problem: { select: { id: true, slug: true, title: true } },
      },
    });
  }

  async findAllForAdmin(problemId?: number, page = 1, pageSize = 20) {
    const where = problemId ? { problemId } : {};
    const [items, total] = await Promise.all([
      this.prisma.solution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          problem: { select: { id: true, slug: true, title: true } },
        },
      }),
      this.prisma.solution.count({ where }),
    ]);
    return { items, total };
  }
}
