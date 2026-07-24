import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SubmissionStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, FeedbackItemDto } from './dto/create-feedback.dto';

/** 状态优先级：越好越靠前 */
const STATUS_RANK: Record<string, number> = {
  AC: 100,
  WA: 50,
  TLE: 40,
  MLE: 40,
  RE: 30,
  CE: 20,
  SE: 10,
  PENDING: 0,
  JUDGING: 0,
};

export type FeedbackItemSnapshot = {
  problemId: number;
  slug: string;
  title: string;
  difficulty: string;
  status: string;
  score: number | null;
  submitCount: number;
};

export type FeedbackLifetimeSnapshot = {
  solvedCount: number;
  totalSubmissions: number;
  totalScore: number;
};

const LOGO_REDIS_KEY = 'feedback:config:logo';
/** data URL 最大约 800KB（Base64 后），约等于 600KB 原图 */
const LOGO_MAX_CHARS = 800_000;

@Injectable()
export class FeedbackService {
  private redis: ReturnType<typeof createClient>;
  private redisReady: Promise<unknown>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    this.redisReady = this.redis.connect().catch((err) => {
      console.error('[FeedbackService] Redis connect failed', err);
    });
  }

  private async ensureRedis() {
    try {
      await this.redisReady;
    } catch {
      /* already logged */
    }
  }

  /** 海报左上角 Logo（data URL），可随时替换 */
  async getLogoUrl(): Promise<string | null> {
    await this.ensureRedis();
    try {
      if (!this.redis.isOpen) return null;
      const v = await this.redis.get(LOGO_REDIS_KEY);
      return v || null;
    } catch {
      return null;
    }
  }

  async setLogoUrl(dataUrl: string): Promise<{ logoUrl: string }> {
    const raw = (dataUrl || '').trim();
    if (!raw.startsWith('data:image/')) {
      throw new BadRequestException('请上传图片（data URL）');
    }
    // 仅允许 png / jpeg / webp / gif
    if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(raw)) {
      throw new BadRequestException('仅支持 PNG / JPEG / WebP / GIF');
    }
    if (raw.length > LOGO_MAX_CHARS) {
      throw new BadRequestException('图片过大，请压缩到约 500KB 以内');
    }
    await this.ensureRedis();
    if (!this.redis.isOpen) {
      throw new BadRequestException('配置存储不可用，请检查 Redis');
    }
    await this.redis.set(LOGO_REDIS_KEY, raw);
    return { logoUrl: raw };
  }

  async clearLogo(): Promise<{ ok: boolean }> {
    await this.ensureRedis();
    try {
      if (this.redis.isOpen) await this.redis.del(LOGO_REDIS_KEY);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  /** 生成 URL-safe 短 token（约 12 字符） */
  private generateToken(): string {
    return randomBytes(9).toString('base64url').slice(0, 12);
  }


  /** 若 end 仅为日期（00:00:00），扩到当天结束，避免漏提交 */
  private normalizeRange(start: Date, end: Date): { start: Date; end: Date } {
    const s = new Date(start);
    const e = new Date(end);
    if (
      e.getHours() === 0 &&
      e.getMinutes() === 0 &&
      e.getSeconds() === 0 &&
      e.getMilliseconds() === 0
    ) {
      e.setHours(23, 59, 59, 999);
    }
    return { start: s, end: e };
  }

  private async uniqueToken(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const token = this.generateToken();
      const exists = await this.prisma.classFeedback.findUnique({
        where: { publicToken: token },
        select: { id: true },
      });
      if (!exists) return token;
    }
    throw new BadRequestException('无法生成唯一短码，请重试');
  }

  /** 与个人主页一致的全站累计 */
  async getLifetimeStats(userId: number): Promise<FeedbackLifetimeSnapshot> {
    const acGroups = await this.prisma.submission.groupBy({
      by: ['problemId'],
      where: { userId, status: SubmissionStatus.AC },
    });
    const totalSubmissions = await this.prisma.submission.count({
      where: { userId },
    });
    const firstAcSubmissions = await this.prisma.$queryRaw<{ score: number }[]>`
      SELECT p.score FROM submissions s
      INNER JOIN problems p ON p.id = s.problem_id
      WHERE s.user_id = ${userId} AND s.status = 'AC'
      AND s.id = (
        SELECT MIN(s2.id) FROM submissions s2
        WHERE s2.user_id = s.user_id AND s2.problem_id = s.problem_id AND s2.status = 'AC'
      )
    `;
    const totalScore = firstAcSubmissions.reduce(
      (sum, r) => sum + Number(r.score || 0),
      0,
    );
    return {
      solvedCount: acGroups.length,
      totalSubmissions,
      totalScore,
    };
  }

  /**
   * 时间窗内按题汇总：最好状态、提交次数、最高分
   */
  async previewSummary(userId: number, start: Date, end: Date) {
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatar: true, role: true, isActive: true },
    });
    if (!student) throw new NotFoundException('学生不存在');

    const range = this.normalizeRange(start, end);
    start = range.start;
    end = range.end;

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('开始时间不能晚于结束时间');
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
        status: { notIn: [SubmissionStatus.PENDING, SubmissionStatus.JUDGING] },
      },
      select: {
        problemId: true,
        status: true,
        score: true,
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    type Agg = {
      problemId: number;
      slug: string;
      title: string;
      difficulty: string;
      status: string;
      score: number | null;
      submitCount: number;
      hasAc: boolean;
    };

    const map = new Map<number, Agg>();
    for (const s of submissions) {
      const existing = map.get(s.problemId);
      if (!existing) {
        map.set(s.problemId, {
          problemId: s.problemId,
          slug: s.problem.slug,
          title: s.problem.title,
          difficulty: s.problem.difficulty,
          status: s.status,
          score: s.score ?? null,
          submitCount: 1,
          hasAc: s.status === SubmissionStatus.AC,
        });
        continue;
      }
      existing.submitCount += 1;
      if (s.status === SubmissionStatus.AC) existing.hasAc = true;
      const curRank = STATUS_RANK[existing.status] ?? 0;
      const newRank = STATUS_RANK[s.status] ?? 0;
      if (newRank > curRank) {
        existing.status = s.status;
      }
      if (s.score != null) {
        if (existing.score == null || s.score > existing.score) {
          existing.score = s.score;
        }
      }
      if (existing.hasAc && existing.status === SubmissionStatus.AC) {
        existing.score = existing.score != null ? Math.max(existing.score, 100) : 100;
      }
    }

    const items = Array.from(map.values()).sort((a, b) =>
      a.slug.localeCompare(b.slug, 'zh-CN'),
    );

    const lifetime = await this.getLifetimeStats(userId);

    return {
      student: {
        id: student.id,
        username: student.username,
        avatar: student.avatar,
      },
      range: { start, end },
      items,
      lifetime,
    };
  }

  private normalizeItems(items: FeedbackItemDto[]): FeedbackItemSnapshot[] {
    return items.map((i) => ({
      problemId: i.problemId,
      slug: i.slug,
      title: i.title,
      difficulty: i.difficulty,
      status: i.status,
      score: i.score ?? null,
      submitCount: i.submitCount,
    }));
  }

  private async resolveItemsFromIds(
    studentId: number,
    problemIds: number[],
    rangeStart?: Date,
    rangeEnd?: Date,
  ): Promise<FeedbackItemSnapshot[]> {
    if (!rangeStart || !rangeEnd) {
      throw new BadRequestException('使用 problemIds 时必须提供 rangeStart 与 rangeEnd');
    }
    const summary = await this.previewSummary(studentId, rangeStart, rangeEnd);
    const idSet = new Set(problemIds);
    const items = summary.items
      .filter((i) => idSet.has(i.problemId))
      .map(({ hasAc: _h, ...rest }) => rest);
    if (items.length === 0) {
      throw new BadRequestException('所选题目在时间窗内无有效提交');
    }
    return items;
  }

  async create(creatorId: number, dto: CreateFeedbackDto) {
    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      select: { id: true, username: true, avatar: true },
    });
    if (!student) throw new NotFoundException('学生不存在');

    const rangeStart = dto.rangeStart ? new Date(dto.rangeStart) : null;
    const rangeEnd = dto.rangeEnd ? new Date(dto.rangeEnd) : null;

    let items: FeedbackItemSnapshot[];
    if (dto.items && dto.items.length > 0) {
      items = this.normalizeItems(dto.items);
    } else if (dto.problemIds && dto.problemIds.length > 0) {
      items = await this.resolveItemsFromIds(
        dto.studentId,
        dto.problemIds,
        rangeStart ?? undefined,
        rangeEnd ?? undefined,
      );
    } else {
      throw new BadRequestException('请提供 items 或 problemIds');
    }

    const lifetime = await this.getLifetimeStats(dto.studentId);
    const publicToken = await this.uniqueToken();

    const displayDate =
      dto.displayDate?.trim() ||
      (rangeStart
        ? `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}-${String(rangeStart.getDate()).padStart(2, '0')}`
        : null);

    const row = await this.prisma.classFeedback.create({
      data: {
        publicToken,
        title: dto.title.trim(),
        studentId: dto.studentId,
        creatorId,
        items: items as unknown as Prisma.InputJsonValue,
        lifetime: lifetime as unknown as Prisma.InputJsonValue,
        note: dto.note?.trim() || null,
        displayDate,
        rangeStart,
        rangeEnd,
      },
      include: {
        student: { select: { id: true, username: true, avatar: true } },
        creator: { select: { id: true, username: true } },
      },
    });

    return this.toAdminView(row);
  }

  async listForAdmin(
    requester: { id: number; role: string },
    page = 1,
    pageSize = 20,
  ) {
    const where =
      requester.role === Role.ADMIN
        ? {}
        : { creatorId: requester.id };

    const [rows, total] = await Promise.all([
      this.prisma.classFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: { select: { id: true, username: true, avatar: true } },
          creator: { select: { id: true, username: true } },
        },
      }),
      this.prisma.classFeedback.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toAdminView(r)),
      total,
      page,
      pageSize,
    };
  }

  async findOneForAdmin(
    id: number,
    requester: { id: number; role: string },
  ) {
    const row = await this.prisma.classFeedback.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, username: true, avatar: true } },
        creator: { select: { id: true, username: true } },
      },
    });
    if (!row) throw new NotFoundException('反馈记录不存在');
    if (requester.role !== Role.ADMIN && row.creatorId !== requester.id) {
      throw new ForbiddenException('无权查看此反馈');
    }
    return this.toAdminView(row);
  }

  async remove(id: number, requester: { id: number; role: string }) {
    const row = await this.prisma.classFeedback.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('反馈记录不存在');
    if (requester.role !== Role.ADMIN && row.creatorId !== requester.id) {
      throw new ForbiddenException('无权删除此反馈');
    }
    await this.prisma.classFeedback.delete({ where: { id } });
    return { ok: true };
  }

  /** 公开接口：仅白名单字段，无代码 / 邮箱 / 手机 */
  async findByPublicToken(token: string) {
    const cleaned = (token || '').trim();
    if (!cleaned) throw new NotFoundException('反馈不存在');

    const row = await this.prisma.classFeedback.findUnique({
      where: { publicToken: cleaned },
      include: {
        student: { select: { username: true, avatar: true } },
      },
    });
    if (!row) throw new NotFoundException('反馈不存在');

    const items = (row.items as unknown as FeedbackItemSnapshot[]) || [];
    const lifetime = (row.lifetime as unknown as FeedbackLifetimeSnapshot) || null;

    const displayDate =
      row.displayDate ||
      (row.rangeStart
        ? `${row.rangeStart.getFullYear()}-${String(row.rangeStart.getMonth() + 1).padStart(2, '0')}-${String(row.rangeStart.getDate()).padStart(2, '0')}`
        : `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, '0')}-${String(row.createdAt.getDate()).padStart(2, '0')}`);

    const logoUrl = (await this.getLogoUrl()) || undefined;

    return {
      publicToken: row.publicToken,
      title: row.title,
      note: row.note,
      createdAt: row.createdAt,
      displayDate,
      dateLabel: displayDate,
      rangeStart: row.rangeStart,
      rangeEnd: row.rangeEnd,
      studentName: row.student.username,
      studentHandle: row.student.username,
      avatarUrl: row.student.avatar || undefined,
      items,
      lifetime: lifetime || undefined,
      brand: '威科姆编程中心',
      logoUrl,
    };
  }


  /**
   * 公开：短链持有者可查看本反馈时间窗内某题的全部提交（含代码）
   * 倒序：最新提交在前
   */
  async getPublicProblemSubmissions(token: string, problemId: number) {
    const cleaned = (token || '').trim();
    if (!cleaned) throw new NotFoundException('反馈不存在');

    const row = await this.prisma.classFeedback.findUnique({
      where: { publicToken: cleaned },
      select: {
        studentId: true,
        rangeStart: true,
        rangeEnd: true,
        items: true,
      },
    });
    if (!row) throw new NotFoundException('反馈不存在');

    const items = (row.items as unknown as FeedbackItemSnapshot[]) || [];
    const snap = items.find((i) => i.problemId === problemId);
    if (!snap) throw new NotFoundException('该反馈中不包含此题目');

    const where: Prisma.SubmissionWhereInput = {
      userId: row.studentId,
      problemId,
      status: { notIn: [SubmissionStatus.PENDING, SubmissionStatus.JUDGING] },
    };

    if (row.rangeStart && row.rangeEnd) {
      const range = this.normalizeRange(row.rangeStart, row.rangeEnd);
      where.createdAt = { gte: range.start, lte: range.end };
    }

    const submissions = await this.prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        language: true,
        status: true,
        score: true,
        timeUsed: true,
        memoryUsed: true,
        code: true,
        createdAt: true,
      },
    });

    return {
      problem: {
        id: snap.problemId,
        slug: snap.slug,
        title: snap.title,
      },
      submissions,
    };
  }

  private toAdminView(row: {
    id: number;
    publicToken: string;
    title: string;
    studentId: number;
    creatorId: number;
    items: Prisma.JsonValue;
    lifetime: Prisma.JsonValue | null;
    note: string | null;
    displayDate?: string | null;
    rangeStart: Date | null;
    rangeEnd: Date | null;
    createdAt: Date;
    updatedAt: Date;
    student?: { id: number; username: string; avatar: string | null };
    creator?: { id: number; username: string };
  }) {
    return {
      id: row.id,
      publicToken: row.publicToken,
      title: row.title,
      studentId: row.studentId,
      creatorId: row.creatorId,
      items: row.items,
      lifetime: row.lifetime,
      note: row.note,
      displayDate: row.displayDate ?? null,
      rangeStart: row.rangeStart,
      rangeEnd: row.rangeEnd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      student: row.student,
      creator: row.creator,
    };
  }
}
