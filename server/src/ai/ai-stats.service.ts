import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { beijingDateString } from './ai-date.util';

@Injectable()
export class AiStatsService {
  private readonly logger = new Logger(AiStatsService.name);
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

  // ─── 后台用户额度管理 ───
  async getUsersQuotas(page = 1, pageSize = 20, username?: string) {
    const where = username ? { username: { contains: username } } : {};
    const total = await this.prisma.user.count({ where });
    const users = await this.prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, username: true, aiDailyLimit: true, role: true },
      orderBy: { id: 'desc' }
    });

    const today = beijingDateString();
    const globalLimit = await this.providerService.getGlobalLimit();
    const result = await Promise.all(users.map(async (u) => {
      const used = Number(await this.redis.get(`ai:usage:${u.id}:${today}`) || '0');
      return {
        ...u,
        usedToday: used,
        effectiveLimit: u.aiDailyLimit !== null ? u.aiDailyLimit : globalLimit
      };
    }));

    return { total, users: result, globalLimit };
  }

  async updateUserQuota(userId: number, aiDailyLimit: number | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { aiDailyLimit }
    });
  }

  // ─── 统计面板 ───
  async getStats() {
    const today = beijingDateString();

    const callPrefix = `ai:stats:${today}:calls:`;
    const tokenPrefix = `ai:stats:${today}:tokens:`;

    let todayCalls = 0;
    let todayTokens = 0;
    const modelStats: Record<string, { calls: number, tokens: number }> = {};

    // 使用 SCAN 替代 KEYS，避免阻塞 Redis
    const collectByPattern = async (pattern: string): Promise<string[]> => {
      const keys: string[] = [];
      let cursor: string = '0';
      do {
        const result = await this.redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== '0');
      return keys;
    };

    const callKeys = await collectByPattern(`${callPrefix}*`);
    const tokenKeys = await collectByPattern(`${tokenPrefix}*`);

    for (const k of callKeys) {
      const model = k.split(':').pop() || 'unknown';
      const count = Number(await this.redis.get(k) || '0');
      todayCalls += count;
      if (!modelStats[model]) modelStats[model] = { calls: 0, tokens: 0 };
      modelStats[model].calls = count;
    }

    for (const k of tokenKeys) {
      const model = k.split(':').pop() || 'unknown';
      const count = Number(await this.redis.get(k) || '0');
      todayTokens += count;
      if (!modelStats[model]) modelStats[model] = { calls: 0, tokens: 0 };
      modelStats[model].tokens = count;
    }

    const totalConversations = await this.prisma.aiConversation.count();
    const totalMessages = await this.prisma.aiMessage.count();

    const usageAgg = await this.prisma.aiUsageLog.aggregate({
      _sum: { totalTokens: true }
    });
    const totalTokens = usageAgg._sum.totalTokens || 0;

    return {
      todayCalls,
      todayTokens,
      modelStats,
      totalConversations,
      totalMessages,
      totalTokens
    };
  }

  async getUsageLogs(page: number, pageSize: number, filters?: { provider?: string, model?: string, startDate?: string, endDate?: string }) {
    const where: any = {};
    if (filters?.provider) where.providerName = { contains: filters.provider };
    if (filters?.model) where.modelName = { contains: filters.model };
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [total, logs] = await Promise.all([
      this.prisma.aiUsageLog.count({ where }),
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return { total, logs };
  }
}
