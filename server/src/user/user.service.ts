import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(username: string, email: string, password: string, role = "USER") {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) throw new ConflictException("用户名或邮箱已存在");

    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { username, email, password: hashed, role: role as any },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }
}
