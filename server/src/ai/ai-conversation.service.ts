import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { AiQuotaService } from './ai-quota.service';
import { AiPromptService } from './ai-prompt.service';

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);

  constructor(
    private prisma: PrismaService,
    private providerService: AiProviderService,
    private quotaService: AiQuotaService,
    private promptService: AiPromptService,
  ) {}

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
    dto: { messages: any[]; problemId: number; currentCode?: string; language?: string; promptConfigId?: number },
    res: any,
  ) {
    // 1. 频率检查
    await this.quotaService.checkAndIncrementUsage(user.id, user.role);

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
    const systemPrompt = await this.promptService.buildSystemPrompt({
      title: problem.title,
      difficulty: problem.difficulty,
      markdown,
      currentCode: dto.currentCode,
      submissions,
      language: dto.language,
      promptConfigId: dto.promptConfigId,
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

    // 安全限制：最多 20 条消息，单条内容最大 5000 字符
    const recentMessages = dto.messages.slice(-20).map((m) => ({
      ...m,
      content: (m.content || '').slice(0, 5000),
    }));

    // 5. 获取模型配置
    const provider = await this.providerService.getActiveProvider();
    const apiBase = provider.apiBase;
    const apiKey = provider.apiKey;
    const modelName = provider.modelName;

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
          stream_options: { include_usage: true },
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
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const startTime = Date.now();
      let reasoningStarted = false;
      let reasoningEnded = false;

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
            if (json.usage) {
              totalTokens = json.usage.total_tokens || 0;
              inputTokens = json.usage.prompt_tokens || 0;
              outputTokens = json.usage.completion_tokens || 0;
            }
            const delta = json.choices?.[0]?.delta;

            // 提取 reasoning_content（思考过程）
            if (delta?.reasoning_content) {
              if (!reasoningStarted) {
                res.write('<think>\n');
                aiResponseContent += '<think>\n';
                reasoningStarted = true;
              }
              res.write(delta.reasoning_content);
              aiResponseContent += delta.reasoning_content;
              totalLength += delta.reasoning_content.length;
            }

            // 提取 content（最终回答）
            if (delta?.content) {
              if (reasoningStarted && !reasoningEnded) {
                res.write('\n</think>\n\n');
                aiResponseContent += '\n</think>\n\n';
                reasoningEnded = true;
              }
              res.write(delta.content);
              aiResponseContent += delta.content;
              totalLength += delta.content.length;
            }
          } catch { /* 忽略解析错误 */ }
        }
      }

      // 流结束时关闭思考标签（如果思考过程中断而没有收到 content）
      if (reasoningStarted && !reasoningEnded) {
        res.write('\n</think>\n\n');
        aiResponseContent += '\n</think>\n\n';
      }

      res.end();

      // 保存统计数据
      try {
        const today = new Date().toISOString().slice(0, 10);
        const redis = this.quotaService.getRedis();
        const callKey = `ai:stats:${today}:calls:${modelName}`;
        const tokenKey = `ai:stats:${today}:tokens:${modelName}`;
        await redis.incr(callKey);

        // 兼容某些提供商不返回 usage 的情况，估算 tokens (中英文字符大致比例估算)
        if (!totalTokens) {
          const promptLength = JSON.stringify(llmMessages).length;
          inputTokens = Math.ceil(promptLength / 1.5);
          outputTokens = Math.ceil(aiResponseContent.length / 1.5);
          totalTokens = inputTokens + outputTokens;
        }
        await redis.incrBy(tokenKey, totalTokens);

        // 插入详细日志到数据库
        await this.prisma.aiUsageLog.create({
          data: {
            userId: user.id,
            providerId: (provider as any).id ?? null,
            providerName: (provider as any).name || 'Unknown',
            modelName: modelName,
            inputTokens,
            outputTokens,
            totalTokens,
            cost: 0,
            timeUsedMs: Date.now() - startTime,
            status: fetchResp.status,
            source: 'chat'
          }
        });

      } catch (statErr) {
        this.logger.warn('Failed to save AI stats: ' + statErr);
      }

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
    } catch (err: any) {
      this.logger.error('AI chat error', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'AI 服务暂时不可用，请稍后重试' });
      } else {
        res.end();
      }
    }
  }
}
