import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(username: string, email?: string, phone?: string, password?: string, role = "USER") {
    const conditions: any[] = [{ username }];
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });
    const existing = await this.prisma.user.findFirst({ where: { OR: conditions } });
    if (existing) throw new ConflictException("用户名、邮箱或手机号已存在");

    const rawPassword: string = password || this.config.get<string>("DEFAULT_USER_PASSWORD") || "123456";
    const hashed = await bcrypt.hash(rawPassword, 10);

    return this.prisma.user.create({
      data: { username, email, phone, password: hashed, role: role as any },
      select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
    });
  }

  async findAll(query: { page?: number; pageSize?: number; keyword?: string; role?: string; isActive?: boolean }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: any = {};

    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword } },
        { email: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, avatar: true, signature: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    // Count total AC problems (distinct)
    const acCount = await this.prisma.submission.groupBy({
      by: ['problemId'],
      where: { userId: user.id, status: 'AC' },
    });
    const totalSubmissions = await this.prisma.submission.count({ where: { userId: user.id } });

    // 计算总分：只计算每道题的第一次AC
    const firstAcSubmissions = await this.prisma.$queryRaw<{score: number}[]>`
      SELECT p.score FROM submissions s
      INNER JOIN problems p ON p.id = s.problem_id
      WHERE s.user_id = ${user.id} AND s.status = 'AC'
      AND s.id = (
        SELECT MIN(s2.id) FROM submissions s2
        WHERE s2.user_id = s.user_id AND s2.problem_id = s.problem_id AND s2.status = 'AC'
      )
    `;
    const totalScore = firstAcSubmissions.reduce((sum, r) => sum + Number(r.score || 0), 0);

    return {
      ...user,
      solvedCount: acCount.length,
      totalSubmissions,
      totalScore,
    };
  }

  async getProfileStats(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('用户不存在');

    // 1. Submission status distribution (pie chart)
    const statusCounts = await this.prisma.submission.groupBy({
      by: ['status'],
      where: { userId: user.id, status: { notIn: ['PENDING', 'JUDGING'] } },
      _count: true,
    });
    const statusDistribution = statusCounts.map((s) => ({ name: s.status, value: s._count }));

    // 2. Heatmap data: daily newly solved problems for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dailySubs = await this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE_FORMAT(first_ac_time, '%Y-%m-%d') as date, COUNT(*) as count
      FROM (
        SELECT problem_id, MIN(created_at) as first_ac_time
        FROM submissions
        WHERE user_id = ${user.id} AND status = 'AC'
        GROUP BY problem_id
      ) as first_acs
      WHERE first_ac_time >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(first_ac_time, '%Y-%m-%d')
      ORDER BY date
    `;
    const heatmapData = dailySubs.map((d) => [d.date, Number(d.count)]);

    // 3. Word Cloud: Tag records
    const tagRecords = await this.prisma.$queryRaw<Array<{ tag: string; count: number }>>`
      SELECT tag, count
      FROM user_tag_records
      WHERE user_id = ${user.id}
    `;
    const wordCloudData = tagRecords.map((t) => ({ name: t.tag, value: Number(t.count) }));

    // 4. AC problem list
    const acProblems = await this.prisma.$queryRaw<Array<{ problem_id: number; slug: string; title: string; difficulty: string }>>`
      SELECT DISTINCT s.problem_id, p.slug, p.title, p.difficulty
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ${user.id} AND s.status = 'AC'
      ORDER BY s.problem_id
    `;

    // 5. Attempted but not AC
    const attemptedProblems = await this.prisma.$queryRaw<Array<{ problem_id: number; slug: string; title: string; difficulty: string }>>`
      SELECT DISTINCT s.problem_id, p.slug, p.title, p.difficulty
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ${user.id}
        AND s.problem_id NOT IN (
          SELECT DISTINCT problem_id FROM submissions WHERE user_id = ${user.id} AND status = 'AC'
        )
      ORDER BY s.problem_id
    `;

    return {
      statusDistribution,
      heatmapData,
      wordCloudData,
      acProblems,
      attemptedProblems,
    };
  }

  async update(id: number, data: { username?: string; email?: string; phone?: string; password?: string; role?: string; isActive?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("用户不存在");

    const updateData: any = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

    // Check uniqueness if changing username/email/phone
    if (data.username || data.email || data.phone) {
      const conditions: any[] = [];
      if (data.username) conditions.push({ username: data.username });
      if (data.email) conditions.push({ email: data.email });
      if (data.phone) conditions.push({ phone: data.phone });
      const conflict = await this.prisma.user.findFirst({
        where: { OR: conditions, NOT: { id } },
      });
      if (conflict) throw new ConflictException("用户名、邮箱或手机号已被占用");
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
    });
  }

  async delete(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("用户不存在");
    return this.prisma.user.delete({ where: { id } });
  }

  async toggleActive(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("用户不存在");
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
    });
  }

  async updateProfile(id: number, data: { email?: string; phone?: string; avatar?: string; signature?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("用户不存在");

    if (data.email || data.phone) {
      const conditions: any[] = [];
      if (data.email) conditions.push({ email: data.email });
      if (data.phone) conditions.push({ phone: data.phone });
      const conflict = await this.prisma.user.findFirst({
        where: { OR: conditions, NOT: { id } },
      });
      if (conflict) throw new ConflictException("邮箱或手机号已被占用");
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, phone: true, avatar: true, signature: true, role: true, isActive: true, createdAt: true },
    });
  }

  async updatePassword(id: number, oldPassword?: string, newPassword?: string) {
    if (!oldPassword || !newPassword) throw new ConflictException("需要提供旧密码和新密码");

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("用户不存在");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new ConflictException("旧密码不正确");

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
    return { success: true };
  }
}
