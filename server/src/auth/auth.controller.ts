import { Controller, Post, Body, Get, UseGuards, Req, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import { AuthService } from "./auth.service";
import { UserService } from "../user/user.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { Request } from "express";

@Controller("auth")
export class AuthController {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private config: ConfigService,
  ) {
    this.redis = createClient({ url: this.config.get("REDIS_URL") });
    this.redis.connect().catch(() => {});
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    // 登录频率限制：同一 IP 5 分钟内最多 10 次尝试
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.ip
      || "unknown";
    const rateLimitKey = `auth:login:rate:${ip}`;
    const attempts = Number(await this.redis.get(rateLimitKey) || "0");

    if (attempts >= 10) {
      throw new HttpException("登录尝试过于频繁，请 5 分钟后重试", HttpStatus.TOO_MANY_REQUESTS);
    }

    try {
      const result = await this.authService.login(dto.account, dto.password);
      // 登录成功，清除该 IP 的失败计数
      await this.redis.del(rateLimitKey);
      return result;
    } catch (err) {
      // 登录失败，增加计数，5 分钟后自动过期
      const count = await this.redis.incr(rateLimitKey);
      if (count === 1) {
        await this.redis.expire(rateLimitKey, 300);
      }
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@CurrentUser() user: { id: number; username: string; role: string }) {
    return this.userService.findById(user.id);
  }
}
