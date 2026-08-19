import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { SubmissionStatus } from "@prisma/client";
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

  async updateResult(submissionId: number, result: { status: string; timeUsed: number; memoryUsed: number; score?: number; testcases?: Array<{ index: number; status: string; timeUsed: number; memoryUsed: number }> }) {
    const terminalStatuses: SubmissionStatus[] = ["AC", "WA", "TLE", "MLE", "RE", "CE", "SE"];
    if (!terminalStatuses.includes(result.status as SubmissionStatus)) {
      throw new BadRequestException("无效的判题结果状态");
    }

    // 先以状态条件原子认领本次回调；重试或重复投递只能有一个请求获胜。
    const claimed = await this.prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: { in: ["PENDING", "JUDGING"] },
      },
      data: {
        status: result.status as any,
        timeUsed: result.timeUsed,
        memoryUsed: result.memoryUsed,
        score: result.score ?? null,
      },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: { problem: true },
      });
      if (!existing) throw new NotFoundException("提交不存在");
      return existing;
    }

    const updated = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });
    if (!updated) throw new NotFoundException("提交不存在");

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

    // 保存每个测试点的结果
    if (result.testcases?.length) {
      await this.prisma.submissionTestCase.createMany({
        data: result.testcases.map(tc => ({
          submissionId,
          index: tc.index,
          status: tc.status as SubmissionStatus,
          timeUsed: tc.timeUsed,
          memoryUsed: tc.memoryUsed,
        })),
      });
    }

    // 重新查询包含 testcases 的完整数据用于 WebSocket 推送
    const fullSubmission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: { select: { id: true, slug: true, title: true } },
        user: { select: { id: true, username: true } },
        testcases: { orderBy: { index: 'asc' } },
      },
    });

    // 推送实时判题结果到订阅的客户端
    this.submissionGateway.notifySubmissionUpdate(submissionId, fullSubmission);

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

  /** MCP 专用：仅接受公开题目，并为每个输入题目返回完整三态。 */
  async getMyPublicProblemStatus(userId: number, problemIds: number[]) {
    const uniqueIds = [...new Set(problemIds)];
    const publicProblems = await this.prisma.problem.findMany({
      where: { id: { in: uniqueIds }, isPublic: true },
      select: { id: true, slug: true, title: true },
      orderBy: { id: 'asc' },
    });
    if (publicProblems.length !== uniqueIds.length) {
      throw new NotFoundException('Problem not found.');
    }
    const submissions = await this.prisma.submission.findMany({
      where: { userId, problemId: { in: uniqueIds } },
      select: { problemId: true, status: true },
    });
    const attempted = new Set(submissions.map((item) => item.problemId));
    const accepted = new Set(submissions.filter((item) => item.status === 'AC').map((item) => item.problemId));
    const problemMap = new Map(publicProblems.map((problem) => [problem.id, problem]));
    return uniqueIds.map((id) => ({
      ...problemMap.get(id)!,
      status: accepted.has(id) ? 'AC' : attempted.has(id) ? 'ATTEMPTED' : 'UNATTEMPTED',
    }));
  }

  /** MCP 专用个人提交摘要：userId 固定来自认证上下文，且只查询公开题目。 */
  async listMyPublicSubmissions(
    userId: number,
    query: {
      page: number;
      pageSize: number;
      problemId?: number;
      status?: SubmissionStatus;
      language?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const where = {
      userId,
      problem: { isPublic: true },
      ...(query.problemId ? { problemId: query.problemId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          language: true,
          status: true,
          score: true,
          timeUsed: true,
          memoryUsed: true,
          createdAt: true,
          problem: { select: { id: true, slug: true, title: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** MCP 专用个人提交详情：所有权在查询条件中强制，源代码只派生大小、不返回正文。 */
  async getMyPublicSubmission(userId: number, id: number) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, userId, problem: { isPublic: true } },
      select: {
        id: true,
        code: true,
        language: true,
        status: true,
        score: true,
        timeUsed: true,
        memoryUsed: true,
        createdAt: true,
        problem: { select: { id: true, slug: true, title: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found.');
    const { code, ...safe } = submission;
    return { ...safe, codeSize: Buffer.byteLength(code, 'utf8') };
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

  async getTestcases(submissionId: number, userId?: number, role?: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { userId: true },
    });
    if (!submission) throw new NotFoundException('提交不存在');

    // 权限检查：提交者本人、TEACHER、ADMIN 可访问
    const isOwner = userId && submission.userId === userId;
    const isPrivileged = role === 'ADMIN' || role === 'TEACHER';
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException('无权查看测试点详情');
    }

    return this.prisma.submissionTestCase.findMany({
      where: { submissionId },
      orderBy: { index: 'asc' },
    });
  }
}
