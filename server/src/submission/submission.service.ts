import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { createClient } from "redis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ProblemService } from "../problem/problem.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";

@Injectable()
export class SubmissionService {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private problemService: ProblemService,
    private config: ConfigService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get("REDIS_URL") });
    await this.redis.connect();
  }

  async create(userId: number, dto: CreateSubmissionDto) {
    const problem = await this.prisma.problem.findUnique({ where: { id: dto.problemId } });
    if (!problem) throw new NotFoundException("题目不存在");

    const submission = await this.prisma.submission.create({
      data: {
        problemId: dto.problemId,
        userId,
        code: dto.code,
        language: dto.language,
        status: "PENDING",
      },
    });

    // 获取测试数据并推入 Redis 队列
    const testcases = await this.problemService.getTestcases(problem.slug);
    const task = {
      submissionId: submission.id,
      problemId: problem.id,
      code: dto.code,
      language: dto.language,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
      testcases,
    };

    await this.redis.lPush("judge:queue", JSON.stringify(task));

    return submission;
  }

  async findOne(id: number) {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        problem: { select: { id: true, slug: true, title: true } },
        user: { select: { id: true, username: true } },
      },
    });
    if (!sub) throw new NotFoundException("提交不存在");
    return sub;
  }

  async findAll(userId?: number, problemId?: number, page = 1, pageSize = 20) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (problemId) where.problemId = problemId;

    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          problem: { select: { id: true, slug: true, title: true } },
          user: { select: { id: true, username: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateResult(submissionId: number, result: { status: string; timeUsed: number; memoryUsed: number }) {
    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: result.status as any,
        timeUsed: result.timeUsed,
        memoryUsed: result.memoryUsed,
      },
    });
  }

  async getByUserAndProblem(userId: number, problemId: number) {
    return this.prisma.submission.findMany({
      where: { userId, problemId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        language: true,
        timeUsed: true,
        memoryUsed: true,
        createdAt: true,
      },
    });
  }
}
