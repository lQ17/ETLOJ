import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { AiQuotaService } from './ai-quota.service';
import { AiPromptService } from './ai-prompt.service';
import * as fs from 'fs';
import { beijingDateString } from './ai-date.util';

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
    dto: { messages: any[]; problemId: number; currentCode?: string; language?: string; promptConfigId?: number; regenerate?: boolean },
    res: any,
    req?: any,
  ) {
    // 1. 预扣额度（失败路径会回滚）
    const quotaCharged = await this.quotaService.checkAndIncrementUsage(user.id, user.role);
    let streamStarted = false;
    let shouldRefund = true; // 成功完成流式输出后置 false

    const refundQuota = async () => {
      if (quotaCharged && shouldRefund) {
        shouldRefund = false;
        await this.quotaService.decrementUsage(user.id, user.role).catch(() => {});
      }
    };

    const failJson = async (status: number, message: string) => {
      await refundQuota();
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    };

    // 客户端断开时 abort 上游
    const abortController = new AbortController();
    let clientClosed = false;
    const onClientClose = () => {
      clientClosed = true;
      abortController.abort();
    };
    if (req) {
      req.on('close', onClientClose);
      req.on('aborted', onClientClose);
    }

    try {
      // 2. 并行获取上下文：题目 + 最近提交（含代码，用于「分析错误」）
      const [problem, submissions] = await Promise.all([
        this.prisma.problem.findUnique({ where: { id: dto.problemId } }),
        this.prisma.submission.findMany({
          where: { userId: user.id, problemId: dto.problemId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            status: true,
            score: true,
            createdAt: true,
            language: true,
            code: true,
          },
        }),
      ]);

      if (!problem) {
        await failJson(404, '题目不存在');
        return;
      }

      // 读取题面 markdown
      let markdown = '';
      try {
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

      // 4. 从本轮请求提取最新用户消息（前端可能带完整历史，但 LLM 上下文以 DB 为准）
      const extractText = (msg: any): string => {
        if (msg.parts && Array.isArray(msg.parts)) {
          return msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        }
        return msg.content || '';
      };

      const isRegenerate = !!dto.regenerate;
      const incomingUserText = [...(dto.messages || [])]
        .reverse()
        .map((m) => ({ role: m.role, text: extractText(m).trim().slice(0, 5000) }))
        .find((m) => m.role === 'user' && m.text)?.text;

      // 新提问必须带用户文本；重新生成可仅依赖 DB 历史
      if (!isRegenerate && !incomingUserText) {
        await failJson(400, '消息内容不能为空');
        return;
      }

      // 5. 获取模型配置
      const provider = await this.providerService.getActiveProvider();
      const apiBase = provider.apiBase;
      const apiKey = provider.apiKey;
      const modelName = provider.modelName;

      // 6. 持久化：新提问追加 user；重新生成则去掉末尾 assistant 后复用同一条 user
      let conversation = await this.prisma.aiConversation.findUnique({
        where: { userId_problemId: { userId: user.id, problemId: dto.problemId } },
      });
      if (!conversation) {
        if (isRegenerate) {
          await failJson(400, '没有可重新生成的对话');
          return;
        }
        conversation = await this.prisma.aiConversation.create({
          data: { userId: user.id, problemId: dto.problemId },
        });
      }

      if (isRegenerate) {
        // 删除末尾连续的 assistant（含中断残留），保留最后一条 user
        const tail = await this.prisma.aiMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { id: 'desc' },
          take: 10,
          select: { id: true, role: true },
        });
        const toDelete: number[] = [];
        for (const row of tail) {
          if (row.role === 'assistant') toDelete.push(row.id);
          else break;
        }
        if (toDelete.length > 0) {
          await this.prisma.aiMessage.deleteMany({ where: { id: { in: toDelete } } });
        }
        const hasUser = await this.prisma.aiMessage.findFirst({
          where: { conversationId: conversation.id, role: 'user' },
          select: { id: true },
        });
        if (!hasUser) {
          await failJson(400, '没有可重新生成的对话');
          return;
        }
      } else {
        await this.prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'user',
            content: incomingUserText!,
          },
        });
      }

      // 取最近 20 条作为模型上下文唯一来源
      const historyRows = await this.prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { id: 'asc' },
        select: { role: true, content: true },
      });
      const historyForLlm = historyRows
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          // 历史 assistant 中的 <think> 块对模型无益且占 token，发送前剥离
          content:
            m.role === 'assistant'
              ? (m.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '(思考过程)').slice(0, 5000)
              : m.content.slice(0, 5000),
        }))
        .filter((m) => m.content.trim());

      // 7. 调用 OpenAI 兼容 API（上下文 = system + DB 历史，不信任前端 messages）
      const llmMessages = [
        { role: 'system', content: systemPrompt },
        ...historyForLlm,
      ];

      let fetchResp: Response;
      try {
        fetchResp = await fetch(`${apiBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: llmMessages,
            stream: true,
            stream_options: { include_usage: true },
            temperature: 0.7,
            max_tokens: 4096,
          }),
          signal: abortController.signal,
        });
      } catch (fetchErr: any) {
        if (clientClosed || fetchErr?.name === 'AbortError') {
          await refundQuota();
          return;
        }
        this.logger.error('LLM fetch failed', fetchErr?.message || fetchErr);
        await failJson(502, 'AI 服务暂时不可用，请稍后重试');
        return;
      }

      if (!fetchResp.ok) {
        const errText = await fetchResp.text().catch(() => '');
        this.logger.error(`LLM API error ${fetchResp.status}: ${errText}`);
        await failJson(502, 'AI 模型服务返回错误');
        return;
      }

      // 流式写入响应
      streamStarted = true;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const reader = fetchResp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiResponseContent = '';
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const startTime = Date.now();
      let reasoningStarted = false;
      let reasoningEnded = false;

      while (true) {
        if (clientClosed) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

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

            if (delta?.reasoning_content) {
              if (!reasoningStarted) {
                if (!clientClosed) res.write('<think>\n');
                aiResponseContent += '<think>\n';
                reasoningStarted = true;
              }
              if (!clientClosed) res.write(delta.reasoning_content);
              aiResponseContent += delta.reasoning_content;
            }

            if (delta?.content) {
              if (reasoningStarted && !reasoningEnded) {
                if (!clientClosed) res.write('\n</think>\n\n');
                aiResponseContent += '\n</think>\n\n';
                reasoningEnded = true;
              }
              if (!clientClosed) res.write(delta.content);
              aiResponseContent += delta.content;
            }
          } catch {
            /* 忽略解析错误 */
          }
        }
      }

      if (reasoningStarted && !reasoningEnded) {
        if (!clientClosed) res.write('\n</think>\n\n');
        aiResponseContent += '\n</think>\n\n';
      }

      if (!clientClosed && !res.writableEnded) {
        res.end();
      }

      // 客户端中途断开且几乎无有效输出：退还额度
      if (clientClosed && !aiResponseContent.trim()) {
        await refundQuota();
        return;
      }

      // 有实际输出则视为成功消耗额度
      shouldRefund = false;

      // 保存统计数据
      try {
        const today = beijingDateString();
        const redis = this.quotaService.getRedis();
        const callKey = `ai:stats:${today}:calls:${modelName}`;
        const tokenKey = `ai:stats:${today}:tokens:${modelName}`;
        await redis.incr(callKey);
        if ((await redis.ttl(callKey)) < 0) await redis.expire(callKey, 86400 * 3);

        if (!totalTokens) {
          const promptLength = JSON.stringify(llmMessages).length;
          inputTokens = Math.ceil(promptLength / 1.5);
          outputTokens = Math.ceil(aiResponseContent.length / 1.5);
          totalTokens = inputTokens + outputTokens;
        }
        await redis.incrBy(tokenKey, totalTokens);
        if ((await redis.ttl(tokenKey)) < 0) await redis.expire(tokenKey, 86400 * 3);

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
            status: clientClosed ? 499 : fetchResp.status,
            source: 'chat',
          },
        });
      } catch (statErr) {
        this.logger.warn('Failed to save AI stats: ' + statErr);
      }

      // 保存 AI 回复（追加）
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
      if (clientClosed || err?.name === 'AbortError') {
        await refundQuota();
        return;
      }
      this.logger.error('AI chat error', err?.message || err);
      if (!streamStarted) {
        await failJson(500, 'AI 服务暂时不可用，请稍后重试');
      } else if (!res.writableEnded) {
        // 流已开始则不退额度（上游可能已产生 token）
        shouldRefund = false;
        res.end();
      } else {
        await refundQuota();
      }
    } finally {
      if (req) {
        req.removeListener?.('close', onClientClose);
        req.removeListener?.('aborted', onClientClose);
      }
    }
  }
}
