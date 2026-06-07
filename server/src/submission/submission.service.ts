import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { createClient } from "redis";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ProblemService } from "../problem/problem.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { QuerySubmissionDto } from "./dto/query-submission.dto";
import { SubmissionGateway } from "./submission.gateway";

@Injectable()
export class SubmissionService {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private problemService: ProblemService,
    private config: ConfigService,
    private submissionGateway: SubmissionGateway,
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
    if (testcases.length === 0) {
      throw new BadRequestException("该题目暂无测试数据，无法提交判题");
    }
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

  async run(userId: number, dto: { code: string; language: string; input: string; problemId: number }) {
    const problem = await this.prisma.problem.findUnique({ where: { id: dto.problemId } });
    if (!problem) throw new NotFoundException("题目不存在");

    const runId = randomUUID();
    const task = {
      runId,
      code: dto.code,
      language: dto.language,
      input: dto.input,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
    };

    await this.redis.lPush("judge:run", JSON.stringify(task));

    // 轮询等待结果（最多 15 秒）
    const maxWait = 15000;
    const interval = 300;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const result = await this.redis.get(`judge:run:result:${runId}`);
      if (result) {
        await this.redis.del(`judge:run:result:${runId}`);
        return JSON.parse(result);
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    return { status: "SE", stdout: "", stderr: "运行超时，请稍后重试", timeUsed: 0 };
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
    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: result.status as any,
        timeUsed: result.timeUsed,
        memoryUsed: result.memoryUsed,
        score: result.score ?? null,
      },
      include: { problem: true },
    });

    // 如果是通过状态，且是首次通过，则增加标签统计
    if (result.status === 'AC') {
      const acCount = await this.prisma.submission.count({
        where: { userId: updated.userId, problemId: updated.problemId, status: 'AC' },
      });

      if (acCount === 1 && updated.userId) {
        // 这是首次 AC，更新用户标签记录（从 ProblemTag 关联表获取标签名称）
        const problemTags = await this.prisma.problemTag.findMany({
          where: { problemId: updated.problemId },
          select: { tag: { select: { name: true } } },
        });
        for (const pt of problemTags) {
          await this.prisma.$executeRaw`
            INSERT INTO user_tag_records (user_id, tag, count, created_at, updated_at)
            VALUES (${updated.userId}, ${pt.tag.name}, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE count = count + 1, updated_at = NOW()
          `;
        }
      }
    }

    // 推送实时判题结果到订阅的客户端
    this.submissionGateway.notifySubmissionUpdate(submissionId, updated);

    return updated;
  }

  async cleanDirty() {
    const result = await this.prisma.submission.deleteMany({
      where: { status: { in: ["SE", "PENDING", "JUDGING"] } },
    });
    return { deletedCount: result.count };
  }

  async getProblemsStatus(userId: number, problemIds: number[]) {
    if (problemIds.length === 0) return {};

    const acSubmissions = await this.prisma.submission.findMany({
      where: { userId, problemId: { in: problemIds }, status: "AC" },
      select: { problemId: true },
      distinct: ["problemId"],
    });
    const acSet = new Set(acSubmissions.map((s) => s.problemId));

    const remainingIds = problemIds.filter((id) => !acSet.has(id));
    let attemptedSet = new Set<number>();
    if (remainingIds.length > 0) {
      const attempted = await this.prisma.submission.findMany({
        where: { userId, problemId: { in: remainingIds } },
        select: { problemId: true },
        distinct: ["problemId"],
      });
      attemptedSet = new Set(attempted.map((s) => s.problemId));
    }

    const result: Record<number, string> = {};
    for (const id of problemIds) {
      if (acSet.has(id)) result[id] = "AC";
      else if (attemptedSet.has(id)) result[id] = "ATTEMPTED";
    }
    return result;
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
