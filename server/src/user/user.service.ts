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
      select: { id: true, username: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
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
        select: { id: true, username: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
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
      select: { id: true, username: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
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
      select: { id: true, username: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
  }
}
