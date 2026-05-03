import { Injectable, NotFoundException } from "@nestjs/common";
import { createClient } from "redis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ProblemService } from "../problem/problem.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { QuerySubmissionDto } from "./dto/query-submission.dto";

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

  async findOne(id: number, requestingUserId: number, requestingUserRole: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        problem: { select: { id: true, slug: true, title: true } },
        user: { select: { id: true, username: true } },
      },
    });
    if (!sub) throw new NotFoundException("提交不存在");

    const canViewCode = sub.userId === requestingUserId
      || requestingUserRole === "TEACHER"
      || requestingUserRole === "ADMIN";
    if (!canViewCode) {
      delete (sub as any).code;
    }

    return sub;
  }

  async findAll(query: QuerySubmissionDto) {
    const { page = 1, pageSize = 20, username, problemId, keyword, status, userId } = query;
    const where: any = {};

    if (username) {
      where.user = { username: { contains: username } };
    }
    if (keyword) {
      where.problem = { title: { contains: keyword } };
    }
    if (problemId) {
      where.problemId = problemId;
    }
    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          problemId: true,
          userId: true,
          language: true,
          status: true,
          score: true,
          timeUsed: true,
          memoryUsed: true,
          code: true,
          createdAt: true,
          problem: { select: { id: true, slug: true, title: true } },
          user: { select: { id: true, username: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    const itemsWithSize = items.map(({ code, ...rest }) => ({
      ...rest,
      codeSize: Buffer.byteLength(code, "utf8"),
    }));

    return { items: itemsWithSize, total, page, pageSize };
  }

  async updateResult(submissionId: number, result: { status: string; timeUsed: number; memoryUsed: number; score?: number }) {
    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: result.status as any,
        timeUsed: result.timeUsed,
        memoryUsed: result.memoryUsed,
        score: result.score ?? null,
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
        score: true,
        language: true,
        timeUsed: true,
        memoryUsed: true,
        createdAt: true,
      },
    });
  }
}
