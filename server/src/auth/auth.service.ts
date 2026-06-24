import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { ReapplyDto } from "./dto/reapply.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async verifyTurnstile(token: string): Promise<boolean> {
    const secretKey = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: token }),
      });
      const data = await res.json();
      if (data.success) {
        return true;
      }

      // 如果第一轮验证失败，并且处于本地开发模式下 (NODE_ENV != 'production')，
      // 则尝试使用官方测试 Secret Key 二次校验，以兼容本地运行时的测试 Site Key。
      if (!data.success && process.env.NODE_ENV !== "production" && secretKey !== "1x0000000000000000000000000000000AA") {
        const testRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "1x0000000000000000000000000000000AA", response: token }),
        });
        const testData = await testRes.json();
        return testData.success;
      }

      return false;
    } catch {
      return false;
    }
  }

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });
    if (existing) {
      throw new BadRequestException("用户名或邮箱已存在");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
        remark: data.remark,
        status: "PENDING",
        role: "USER",
      },
    });

    return { message: "注册成功，请等待管理员审核", userId: user.id };
  }

  async login(account: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: account }, { email: account }, { phone: account }],
      },
    });
    if (!user) throw new UnauthorizedException("用户名或密码错误");
    if (!user.isActive) throw new UnauthorizedException("账号已被停用，请联系管理员");
    
    if (user.status === "PENDING") {
      throw new UnauthorizedException("您的账号正在审核中，请耐心等待");
    }
    if (user.status === "REJECTED") {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: `您的注册申请已被拒绝${user.rejectReason ? '：' + user.rejectReason : ''}`,
          code: "REGISTRATION_REJECTED",
          username: user.username,
          email: user.email,
          remark: user.remark,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException("用户名或密码错误");

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async reapply(data: ReapplyDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (!user) {
      throw new BadRequestException("用户不存在");
    }
    if (user.status !== "REJECTED") {
      throw new BadRequestException("只有被拒绝的账号才能重新提交申请");
    }

    // 验证密码
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      throw new BadRequestException("密码错误");
    }

    // 检查邮箱冲突（排除自身）
    const emailConflict = await this.prisma.user.findFirst({
      where: {
        email: data.email,
        id: { not: user.id },
      },
    });
    if (emailConflict) {
      throw new BadRequestException("邮箱已被其他用户占用");
    }

    // 更新用户
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: data.email,
        remark: data.remark,
        status: "PENDING",
        rejectReason: null, // 清空拒绝理由
      },
    });

    return { message: "重新提交申请成功，请等待管理员审核" };
  }
}

