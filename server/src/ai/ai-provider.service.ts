import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private redis: ReturnType<typeof createClient>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    this.redis = createClient({ url: this.config.get('REDIS_URL') });
    await this.redis.connect();
  }

  // ─── 获取 AI 配置（优先 Redis，回退到环境变量） ───

  private async getConfigValue(key: string, envKey: string, defaultVal: string): Promise<string> {
    const redisVal = await this.redis.get(`ai:config:${key}`);
    return redisVal ?? this.config.get(envKey) ?? defaultVal;
  }

  // ─── 供应商管理 (Providers) ───

  async getProviders() {
    return this.prisma.aiProvider.findMany({ orderBy: { id: 'asc' } });
  }

  async addProvider(dto: { name: string; apiBase: string; apiKey: string; modelName: string; isActive?: boolean }) {
    if (dto.isActive) {
      await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    }
    return this.prisma.aiProvider.create({ data: dto });
  }

  async updateProvider(id: number, dto: { name?: string; apiBase?: string; apiKey?: string; modelName?: string; isActive?: boolean }) {
    if (dto.isActive) {
      await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    }
    return this.prisma.aiProvider.update({ where: { id }, data: dto });
  }

  async deleteProvider(id: number) {
    return this.prisma.aiProvider.delete({ where: { id } });
  }

  async activateProvider(id: number) {
    await this.prisma.aiProvider.updateMany({ data: { isActive: false } });
    return this.prisma.aiProvider.update({ where: { id }, data: { isActive: true } });
  }

  async fetchAvailableModels(apiBase: string, apiKey: string) {
    let baseUrl = apiBase.trim();
    if (baseUrl.endsWith('/chat/completions')) {
      baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
    }
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const url = `${baseUrl}/models`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP error ${response.status}`);
      }
      const data: any = await response.json();
      if (data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id);
      }
      return [];
    } catch (err: any) {
      throw new ForbiddenException('获取模型列表失败: ' + err.message);
    }
  }

  // ─── 获取活动 AI 配置 ───
  async getActiveProvider() {
    const active = await this.prisma.aiProvider.findFirst({ where: { isActive: true } });
    if (active) return active;
    return {
      name: 'Default',
      apiBase: await this.getConfigValue('apiBase', 'AI_API_BASE', 'https://ai.ssdevops.com/v1'),
      apiKey: await this.getConfigValue('apiKey', 'AI_API_KEY', ''),
      modelName: await this.getConfigValue('model', 'AI_MODEL', 'glm-5-fp8'),
    };
  }

  async getGlobalLimit() {
    return Number(await this.getConfigValue('dailyLimit', 'AI_DAILY_LIMIT', '100'));
  }

  async setGlobalLimit(dailyLimit: number) {
    await this.redis.set('ai:config:dailyLimit', String(dailyLimit));
    return { success: true };
  }
}
