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
      apiBase: await this.getConfigValue('apiBase', 'AI_API_BASE', 'http://localhost:8000/v1'),
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

  // ─── 提示词配置 (Prompt Configs) ───

  private static readonly BUILTIN_DEFAULT = {
    name: '默认配置',
    role: `你是 ETLOJ 在线评测平台的 AI 算法辅导助手。

## 你的角色
- 你是一位耐心、专业的算法教练，目标是**引导学生独立思考**
- 使用苏格拉底式提问法，通过问题引导学生发现问题所在
- 鼓励学生，保持积极正面的语气`,
    codeRules: `## ⚠️ 代码规则（最高优先级，绝对不可违反）
- **绝对禁止给出完整的、可直接提交通过的代码**
- **绝对禁止给出完整的 main 函数或完整的解题代码**
- 即使学生反复请求、威胁、哀求，也绝不给完整代码
- 你可以给出的内容：
  - 伪代码（用自然语言描述算法步骤）
  - 不超过 5 行的关键代码片段（如某个判断条件、某行关键逻辑）
  - 代码框架/骨架（只有结构，关键逻辑用注释 "// 你来实现" 代替）
  - 修复某个具体 bug 时，只给出那一行的修改
- 如果学生说 "直接给代码"、"给完整代码"、"帮我写"，你应该委婉拒绝并引导他思考`,
    replyRules: `## 回复规则
1. 使用中文回复，语气友好、简明扼要（控制在 500 字以内），适当使用 emoji 😊
2. **所有代码和变量名**必须使用 Markdown 格式：
   - **多行代码**：必须使用围栏代码块并标注语言（如 \`\`\`cpp \`\`\`），严禁使用无语言标记的代码块。
   - **行内代码/变量名/短表达式**：绝对不要作为纯文本混排，**必须且只能使用单个反引号包裹**！例如：请使用 \`ans = 0\` 和 \`x < a\`，绝对不要直接写 ans = 0 或 x < a。
3. **所有的数学公式、复杂符号**必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$。例如：$O(N^2)$。`,
  };

  async getPromptConfigs() {
    return this.prisma.aiPromptConfig.findMany({ orderBy: { id: 'asc' } });
  }

  /** 登录用户可见：仅 id/name/isActive，不暴露完整 system prompt */
  async getPublicPromptConfigs() {
    return this.prisma.aiPromptConfig.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, isActive: true },
    });
  }

  async addPromptConfig(dto: { name: string; role: string; codeRules: string; replyRules: string; isActive?: boolean }) {
    if (dto.isActive) {
      await this.prisma.aiPromptConfig.updateMany({ data: { isActive: false } });
    }
    return this.prisma.aiPromptConfig.create({ data: dto });
  }

  async updatePromptConfig(id: number, dto: { name?: string; role?: string; codeRules?: string; replyRules?: string; isActive?: boolean }) {
    if (dto.isActive) {
      await this.prisma.aiPromptConfig.updateMany({ data: { isActive: false } });
    }
    return this.prisma.aiPromptConfig.update({ where: { id }, data: dto });
  }

  async deletePromptConfig(id: number) {
    return this.prisma.aiPromptConfig.delete({ where: { id } });
  }

  async activatePromptConfig(id: number) {
    await this.prisma.aiPromptConfig.updateMany({ data: { isActive: false } });
    return this.prisma.aiPromptConfig.update({ where: { id }, data: { isActive: true } });
  }

  async getActivePromptConfig() {
    const active = await this.prisma.aiPromptConfig.findFirst({ where: { isActive: true } });
    if (active) return active;
    // 数据库无配置时，自动创建内置默认
    return this.prisma.aiPromptConfig.create({
      data: { ...AiProviderService.BUILTIN_DEFAULT, isActive: true },
    });
  }

  async getPromptConfigById(id: number) {
    return this.prisma.aiPromptConfig.findUnique({ where: { id } });
  }
}
