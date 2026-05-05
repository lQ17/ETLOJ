import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSolutionDto } from "./dto/create-solution.dto";
import { UpdateSolutionDto } from "./dto/update-solution.dto";

@Injectable()
export class SolutionService {
  constructor(private prisma: PrismaService) {}

  async findByProblem(problemId: number) {
    return this.prisma.solution.findMany({
      where: { problemId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
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
    return this.prisma.solution.update({
      where: { id },
      data: { content: dto.content },
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
}
