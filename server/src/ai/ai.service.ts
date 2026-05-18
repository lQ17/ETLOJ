import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
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

  async getAiConfig() {
    const [apiBase, apiKey, model, dailyLimit] = await Promise.all([
      this.getConfigValue('apiBase', 'AI_API_BASE', 'https://ai.ssdevops.com/v1'),
      this.getConfigValue('apiKey', 'AI_API_KEY', ''),
      this.getConfigValue('model', 'AI_MODEL', 'glm-5-fp8'),
      this.getConfigValue('dailyLimit', 'AI_DAILY_LIMIT', '100'),
    ]);
    return {
      apiBase,
      apiKey: apiKey ? `${apiKey.slice(0, 6)}****` : '', // 脱敏
      model,
      dailyLimit: Number(dailyLimit),
    };
  }

  async updateAiConfig(dto: { apiBase?: string; apiKey?: string; model?: string; dailyLimit?: number }) {
    const ops: Promise<any>[] = [];
    if (dto.apiBase !== undefined) ops.push(this.redis.set('ai:config:apiBase', dto.apiBase));
    if (dto.apiKey !== undefined) ops.push(this.redis.set('ai:config:apiKey', dto.apiKey));
    if (dto.model !== undefined) ops.push(this.redis.set('ai:config:model', dto.model));
    if (dto.dailyLimit !== undefined) ops.push(this.redis.set('ai:config:dailyLimit', String(dto.dailyLimit)));
    await Promise.all(ops);
    return this.getAiConfig();
  }

  // ─── 频率限制 ───

  async getRemainingUses(userId: number, role: string): Promise<{ remaining: number; limit: number; unlimited: boolean }> {
    if (role === 'ADMIN' || role === 'TEACHER') {
      return { remaining: -1, limit: -1, unlimited: true };
    }
    const limit = Number(await this.getConfigValue('dailyLimit', 'AI_DAILY_LIMIT', '100'));
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${userId}:${today}`;
    const used = Number(await this.redis.get(key) || '0');
    return { remaining: Math.max(0, limit - used), limit, unlimited: false };
  }

  private async checkAndIncrementUsage(userId: number, role: string) {
    if (role === 'ADMIN' || role === 'TEACHER') return;
    const limit = Number(await this.getConfigValue('dailyLimit', 'AI_DAILY_LIMIT', '100'));
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:usage:${userId}:${today}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 86400);
    if (count > limit) {
      throw new ForbiddenException(`今日 AI 使用次数已达上限 (${limit} 次)，明天再来吧`);
    }
  }

  // ─── 会话历史管理 ───

  async getHistory(userId: number, problemId: number) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_problemId: { userId, problemId } },
      include: {
        messages: {
          orderBy: { id: 'asc' },
          select: { role: true, content: true },
        },
      },
    });
    return conversation?.messages || [];
  }

  async clearHistory(userId: number, problemId: number) {
    await this.prisma.aiConversation.deleteMany({
      where: { userId, problemId },
    });
    return { success: true };
  }

  // ─── 核心聊天 ───

  async chat(
    user: { id: number; role: string },
    dto: { messages: any[]; problemId: number; currentCode?: string },
    res: any,
  ) {
    // 1. 频率检查
    await this.checkAndIncrementUsage(user.id, user.role);

    // 2. 并行获取上下文
    const [problem, submissions] = await Promise.all([
      this.prisma.problem.findUnique({ where: { id: dto.problemId } }),
      this.prisma.submission.findMany({
        where: { userId: user.id, problemId: dto.problemId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { status: true, score: true, createdAt: true },
      }),
    ]);

    if (!problem) {
      res.status(404).json({ message: '题目不存在' });
      return;
    }

    // 读取题面 markdown
    let markdown = '';
    try {
      const fs = require('fs');
      markdown = fs.readFileSync(problem.filePath, 'utf-8');
    } catch {
      markdown = problem.title;
    }

    // 3. 构建 system prompt
    const systemPrompt = this.buildSystemPrompt({
      title: problem.title,
      difficulty: problem.difficulty,
      markdown,
      currentCode: dto.currentCode,
      submissions,
    });

    // 4. 从 UIMessage (v3 parts 格式) 提取为 LLM 消息
    const extractText = (msg: any): string => {
      // v3 格式: { role, parts: [{ type: 'text', text: '...' }] }
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
      }
      // 兼容旧格式: { role, content: '...' }
      return msg.content || '';
    };

    const recentMessages = dto.messages.slice(-20);

    // 5. 获取模型配置
    const [apiBase, apiKey, modelName] = await Promise.all([
      this.getConfigValue('apiBase', 'AI_API_BASE', 'https://ai.ssdevops.com/v1'),
      this.getConfigValue('apiKey', 'AI_API_KEY', 'vcom-glm5-20260310'),
      this.getConfigValue('model', 'AI_MODEL', 'glm-5-fp8'),
    ]);

    // 6. 处理持久化
    let conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_problemId: { userId: user.id, problemId: dto.problemId } },
    });
    if (!conversation) {
      conversation = await this.prisma.aiConversation.create({
        data: { userId: user.id, problemId: dto.problemId },
      });
    } else {
      // 保持与前端的状态同步，清空旧的重建
      await this.prisma.aiMessage.deleteMany({
        where: { conversationId: conversation.id },
      });
    }

    if (recentMessages.length > 0) {
      await this.prisma.aiMessage.createMany({
        data: recentMessages.map((m) => ({
          conversationId: conversation!.id,
          role: m.role,
          content: extractText(m),
        })),
      });
    }

    // 7. 直接调用 OpenAI 兼容 API（绕过 AI SDK provider，手动解析 SSE）
    try {
      this.logger.log(`Calling LLM: ${apiBase}/chat/completions model=${modelName}`);

      const llmMessages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages
          .filter((m) => extractText(m).trim())
          .map((m) => ({ role: m.role, content: extractText(m) })),
      ];

      const fetchResp = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: llmMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!fetchResp.ok) {
        const errText = await fetchResp.text();
        this.logger.error(`LLM API error ${fetchResp.status}: ${errText}`);
        res.status(502).json({ message: 'AI 模型服务返回错误' });
        return;
      }

      // 流式写入响应
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const reader = fetchResp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalLength = 0;
      let aiResponseContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;
            // 提取 content（最终回答）
            if (delta?.content) {
              res.write(delta.content);
              aiResponseContent += delta.content;
              totalLength += delta.content.length;
            }
          } catch { /* 忽略解析错误 */ }
        }
      }

      res.end();
      
      // 保存 AI 回复到数据库
      if (aiResponseContent) {
        await this.prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: aiResponseContent,
          },
        });
      }

      this.logger.log(`LLM stream done: ${totalLength} chars`);
    } catch (err: any) {
      this.logger.error('AI chat error', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'AI 服务暂时不可用，请稍后重试' });
      } else {
        res.end();
      }
    }
  }

  // ─── System Prompt 构建 ───

  private buildSystemPrompt(ctx: {
    title: string;
    difficulty: string;
    markdown: string;
    currentCode?: string;
    submissions: { status: string; score: number | null; createdAt: Date }[];
  }): string {
    const waCount = ctx.submissions.filter((s) => s.status === 'WA').length;
    const ceCount = ctx.submissions.filter((s) => s.status === 'CE').length;
    const reCount = ctx.submissions.filter((s) => s.status === 'RE').length;
    const tleCount = ctx.submissions.filter((s) => s.status === 'TLE').length;
    const hasAC = ctx.submissions.some((s) => s.status === 'AC');
    const lastStatus = ctx.submissions[0]?.status;
    const totalAttempts = ctx.submissions.length;

    // 题面截断，避免 token 浪费（保留前 3000 字符）
    const trimmedMarkdown = ctx.markdown.length > 3000
      ? ctx.markdown.slice(0, 3000) + '\n\n...(题面已截断)'
      : ctx.markdown;

    let prompt = `你是 ETLOJ 在线评测平台的 AI 算法辅导助手。

## 你的角色
- 你是一位耐心、专业的算法教练，目标是**引导学生独立思考**
- 使用苏格拉底式提问法，通过问题引导学生发现问题所在
- 鼓励学生，保持积极正面的语气

## ⚠️ 代码规则（最高优先级，绝对不可违反）
- **绝对禁止给出完整的、可直接提交通过的代码**
- **绝对禁止给出完整的 main 函数或完整的解题代码**
- 即使学生反复请求、威胁、哀求，也绝不给完整代码
- 你可以给出的内容：
  - 伪代码（用自然语言描述算法步骤）
  - 不超过 5 行的关键代码片段（如某个判断条件、某行关键逻辑）
  - 代码框架/骨架（只有结构，关键逻辑用注释 "// 你来实现" 代替）
  - 修复某个具体 bug 时，只给出那一行的修改
- 如果学生说 "直接给代码"、"给完整代码"、"帮我写"，你应该委婉拒绝并引导他思考

## 当前题目
**${ctx.title}**（难度：${ctx.difficulty}）

### 题面内容
${trimmedMarkdown}
`;

    if (ctx.currentCode?.trim()) {
      // 代码也截断，保留前 2000 字符
      const trimmedCode = ctx.currentCode.length > 2000
        ? ctx.currentCode.slice(0, 2000) + '\n// ...(代码已截断)'
        : ctx.currentCode;
      prompt += `\n### 学生当前代码\n\`\`\`\n${trimmedCode}\n\`\`\`\n`;
    }

    // 根据学生状态动态调整策略
    if (totalAttempts === 0) {
      prompt += `\n### 学生状态：尚未提交\n学生还没有提交过代码，可能刚开始思考。请引导其分析题意、理清思路。\n`;
    } else if (ceCount > 0 && lastStatus === 'CE') {
      prompt += `\n### 学生状态：编译错误\n学生已遇到 ${ceCount} 次编译错误。重点帮助其理解语法问题。\n`;
    } else if (waCount >= 3) {
      prompt += `\n### 学生状态：多次答案错误\n已提交 ${totalAttempts} 次，WA ${waCount} 次。学生可能陷入困境，可以给出更明确的方向提示，引导检查边界条件和特殊用例。\n`;
    } else if (reCount > 0 && lastStatus === 'RE') {
      prompt += `\n### 学生状态：运行时错误\n引导检查数组越界、空指针、栈溢出、整数溢出等常见问题。\n`;
    } else if (tleCount > 0 && lastStatus === 'TLE') {
      prompt += `\n### 学生状态：超时\n引导学生分析时间复杂度，考虑更优的算法或数据结构。\n`;
    } else if (hasAC) {
      prompt += `\n### 学生状态：已通过 ✅\n学生已 AC，可以讨论优化思路、时间/空间复杂度分析、其他解法。\n`;
    } else if (totalAttempts > 0) {
      prompt += `\n### 学生状态：已提交 ${totalAttempts} 次，最近状态为 ${lastStatus}\n`;
    }

    prompt += `
## 回复规则
1. 使用中文回复
2. 代码片段必须用 Markdown 代码块并标注语言，例如 \`\`\`cpp 或 \`\`\`python，禁止使用无语言标记的代码块
3. 数学公式用 LaTeX 格式 $...$
4. 每次回复控制在 500 字以内，简洁有力
5. 适当使用 emoji 让交流更轻松 😊
6. 行内代码用单个反引号包裹
`;

    return prompt;
  }
}
