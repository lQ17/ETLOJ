import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiQuotaService {
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private providerService: AiProviderService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    await this.redis.connect();
  }

  private async getUserLimit(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { aiDailyLimit: true } });
    if (user?.aiDailyLimit !== null && user?.aiDailyLimit !== undefined) {
      return user.aiDailyLimit;
    }
    return this.providerService.getGlobalLimit();
  }

  async getRemainingUses(userId: number, role: string): Promise<{ remaining: number; limit: number; unlimited: boolean }> {
    if (role === 'ADMIN' || role === 'TEACHER') {
      return { remaining: -1, limit: -1, unlimited: true };
    }
    const limit = await this.getUserLimit(userId);
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${userId}:${today}`;
    const used = Number(await this.redis.get(key) || '0');
    return { remaining: Math.max(0, limit - used), limit, unlimited: false };
  }

  async checkAndIncrementUsage(userId: number, role: string) {
    if (role === 'ADMIN' || role === 'TEACHER') return;
    const limit = await this.getUserLimit(userId);
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${userId}:${today}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 86400);
    if (count > limit) {
      throw new ForbiddenException(`今日 AI 使用次数已达上限 (${limit} 次)，明天再来吧`);
    }
  }

  getRedis() {
    return this.redis;
  }
}
