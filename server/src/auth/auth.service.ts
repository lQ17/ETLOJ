import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(account: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: account }, { email: account }, { phone: account }],
      },
    });
    if (!user) throw new UnauthorizedException("用户名或密码错误");
    if (!user.isActive) throw new UnauthorizedException("账号已被停用，请联系管理员");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException("用户名或密码错误");

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, username: user.username, role: user.role },
    };
  }
}
