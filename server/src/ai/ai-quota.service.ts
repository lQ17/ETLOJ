import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { beijingDateString } from './ai-date.util';

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

  /** 日额度 Redis key（按北京时间自然日） */
  private usageKey(userId: number) {
    return `ai:usage:${userId}:${beijingDateString()}`;
  }

  async getRemainingUses(userId: number, role: string): Promise<{ remaining: number; limit: number; unlimited: boolean }> {
    if (role === 'ADMIN' || role === 'TEACHER') {
      return { remaining: -1, limit: -1, unlimited: true };
    }
    const limit = await this.getUserLimit(userId);
    const used = Number(await this.redis.get(this.usageKey(userId)) || '0');
    return { remaining: Math.max(0, limit - used), limit, unlimited: false };
  }

  /**
   * 预扣额度。超限时回滚并抛错。
   * @returns 是否实际扣了次数（ADMIN/TEACHER 不扣，返回 false）
   */
  async checkAndIncrementUsage(userId: number, role: string): Promise<boolean> {
    if (role === 'ADMIN' || role === 'TEACHER') return false;
    const limit = await this.getUserLimit(userId);
    const key = this.usageKey(userId);
    const count = await this.redis.incr(key);
    // 保留 2 天，覆盖跨日与时钟偏差
    if (count === 1) await this.redis.expire(key, 86400 * 2);
    if (count > limit) {
      await this.redis.decr(key);
      throw new ForbiddenException(`今日 AI 使用次数已达上限 (${limit} 次)，明天再来吧`);
    }
    return true;
  }

  /** 调用失败时退还预扣次数（不会减到负数） */
  async decrementUsage(userId: number, role: string) {
    if (role === 'ADMIN' || role === 'TEACHER') return;
    const key = this.usageKey(userId);
    const val = await this.redis.get(key);
    if (val && Number(val) > 0) {
      await this.redis.decr(key);
    }
  }

  getRedis() {
    return this.redis;
  }
}
