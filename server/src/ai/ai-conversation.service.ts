import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { AiQuotaService } from './ai-quota.service';
import { AiPromptService } from './ai-prompt.service';
import type { AiChatAction, AiSubmissionContext } from './ai-prompt.service';
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

  private findAccessibleProblem(user: { id: number; role: string }, problemId: number) {
    const canManageHidden = user.role === 'ADMIN' || user.role === 'TEACHER';
    return this.prisma.problem.findFirst({
      where: {
        id: problemId,
        ...(canManageHidden ? {} : { isPublic: true }),
      },
    });
  }

  // ─── 会话历史管理 ───

  async getHistory(user: { id: number; role: string }, problemId: number) {
    const problem = await this.findAccessibleProblem(user, problemId);
    if (!problem) throw new NotFoundException('题目不存在');
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_problemId: { userId: user.id, problemId } },
      include: {
        messages: {
          orderBy: { id: 'desc' },
          take: 100,
          select: { role: true, content: true },
        },
      },
    });
    return conversation?.messages ? [...conversation.messages].reverse() : [];
  }

  async clearHistory(user: { id: number; role: string }, problemId: number) {
    const problem = await this.findAccessibleProblem(user, problemId);
    if (!problem) throw new NotFoundException('题目不存在');
    await this.prisma.aiConversation.deleteMany({
      where: { userId: user.id, problemId },
    });
    return { success: true };
  }

  // ─── 核心聊天 ───

  async chat(
    user: { id: number; role: string },
    dto: { messages: any[]; problemId: number; action?: 'CHAT' | 'IDEA' | 'CHECK_CODE' | 'OPTIMIZE' | 'ANALYZE_ERROR'; currentCode?: string; language?: string; promptConfigId?: number; regenerate?: boolean },
    res: any,
    req?: any,
  ) {
    // 1. 预扣额度（失败路径会回滚）
    const quotaCharged = await this.quotaService.checkAndIncrementUsage(user.id, user.role);
    let streamStarted = false;
    let shouldRefund = true; // 成功完成流式输出后置 false
    let responseConversationId: number | null = null;
    let streamedResponseContent = '';

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
      if (res.writableEnded) return;
      clientClosed = true;
      abortController.abort();
    };
    if (req) {
      req.on('aborted', onClientClose);
    }
    res.on?.('close', onClientClose);

    try {
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

      if (!isRegenerate && !incomingUserText) {
        await failJson(400, '消息内容不能为空');
        return;
      }

      let conversation = await this.prisma.aiConversation.findUnique({
        where: { userId_problemId: { userId: user.id, problemId: dto.problemId } },
      });

      const validActions: AiChatAction[] = ['CHAT', 'IDEA', 'CHECK_CODE', 'OPTIMIZE', 'ANALYZE_ERROR'];
      let action: AiChatAction = dto.action && validActions.includes(dto.action) ? dto.action : 'CHAT';
      if (isRegenerate) {
        if (!conversation) {
          await failJson(400, '没有可重新生成的对话');
          return;
        }
        const lastUser = await this.prisma.aiMessage.findFirst({
          where: { conversationId: conversation.id, role: 'user' },
          orderBy: { id: 'desc' },
          select: { id: true, action: true },
        });
        if (!lastUser) {
          await failJson(400, '没有可重新生成的对话');
          return;
        }
        if (lastUser.action && validActions.includes(lastUser.action as AiChatAction)) {
          action = lastUser.action as AiChatAction;
        }
      }

      if ((action === 'CHECK_CODE' || action === 'OPTIMIZE') && !dto.currentCode?.trim()) {
        await failJson(400, '请先在编辑器中编写代码');
        return;
      }

      // 先校验题目访问权限，再查询任何与用户提交有关的上下文。
      const problem = await this.findAccessibleProblem(user, dto.problemId);

      if (!problem) {
        await failJson(404, '题目不存在');
        return;
      }

      let markdown = '';
      try {
        markdown = await fs.promises.readFile(problem.filePath, 'utf-8');
      } catch {
        markdown = problem.title;
      }

      const terminalStatuses = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'SE'] as const;
      const failedStatuses = ['WA', 'TLE', 'MLE', 'RE', 'CE', 'SE'] as const;
      let submissions: AiSubmissionContext[] = [];
      let targetSubmission: AiSubmissionContext | undefined;

      if (action === 'ANALYZE_ERROR') {
        const found = await this.prisma.submission.findFirst({
          where: {
            userId: user.id,
            problemId: dto.problemId,
            status: { in: [...failedStatuses] },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            status: true,
            score: true,
            timeUsed: true,
            memoryUsed: true,
            createdAt: true,
            language: true,
            code: true,
            diagnostic: true,
            testcases: {
              orderBy: { index: 'asc' },
              select: { status: true, timeUsed: true, memoryUsed: true },
            },
          },
        });
        if (!found) {
          await failJson(409, '当前题目还没有可分析的失败提交');
          return;
        }
        targetSubmission = found as AiSubmissionContext;
      } else if (action === 'CHAT') {
        submissions = await this.prisma.submission.findMany({
          where: {
            userId: user.id,
            problemId: dto.problemId,
            status: { in: [...terminalStatuses] },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
          select: {
            id: true,
            status: true,
            score: true,
            timeUsed: true,
            memoryUsed: true,
            createdAt: true,
            language: true,
          },
        }) as AiSubmissionContext[];
      }

      const systemPrompt = await this.promptService.buildSystemPrompt({
        action,
        title: problem.title,
        difficulty: problem.difficulty,
        markdown,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
        currentCode: action === 'IDEA' || action === 'ANALYZE_ERROR' ? undefined : dto.currentCode,
        submissions,
        targetSubmission,
        language: action === 'ANALYZE_ERROR' ? targetSubmission?.language : dto.language,
        promptConfigId: dto.promptConfigId,
      });

      // 5. 获取模型配置
      const provider = await this.providerService.getActiveProvider();
      const apiBase = provider.apiBase;
      const apiKey = provider.apiKey;
      const modelName = provider.modelName;

      // 6. 持久化：新提问追加 user；重新生成则去掉末尾 assistant 后复用同一条 user
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
            action,
            content: incomingUserText!,
          },
        });
      }
      responseConversationId = conversation.id;

      // 取最近 20 条作为模型上下文唯一来源
      const historyRows = await this.prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { id: 'asc' },
        select: { role: true, content: true },
      });
      const lastUserRow = [...historyRows].reverse().find((m) => m.role === 'user');
      const contextRows = action === 'CHAT'
        ? historyRows.slice(-20)
        : lastUserRow ? [lastUserRow] : [];
      const historyForLlm = contextRows
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
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
      let totalTokens = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const startTime = Date.now();

      const processSseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trimStart();
        if (!payload || payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          if (json.usage) {
            totalTokens = json.usage.total_tokens || 0;
            inputTokens = json.usage.prompt_tokens || 0;
            outputTokens = json.usage.completion_tokens || 0;
          }
          // reasoning_content 属于模型内部推理，不向用户输出，也不写入聊天历史。
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            if (!clientClosed) res.write(content);
            streamedResponseContent += content;
          }
        } catch {
          /* 忽略非 JSON 的 SSE 扩展行 */
        }
      };

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
          processSseLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) processSseLine(buffer);

      if (!clientClosed && !streamedResponseContent.trim()) {
        await refundQuota();
        const emptyReply = 'AI 模型未返回有效回答，请重试。';
        if (!res.writableEnded) {
          res.write(emptyReply);
          res.end();
        }
        await this.prisma.aiMessage.create({
          data: { conversationId: conversation.id, role: 'assistant', content: emptyReply },
        });
        return;
      }

      if (!clientClosed && !res.writableEnded) {
        res.end();
      }

      // 客户端中途断开且几乎无有效输出：退还额度
      if (clientClosed && !streamedResponseContent.trim()) {
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
          outputTokens = Math.ceil(streamedResponseContent.length / 1.5);
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
      if (streamedResponseContent) {
        await this.prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: streamedResponseContent,
          },
        });
      }
    } catch (err: any) {
      if (clientClosed || err?.name === 'AbortError') {
        if (streamedResponseContent.trim() && responseConversationId) {
          shouldRefund = false;
          await this.prisma.aiMessage.create({
            data: { conversationId: responseConversationId, role: 'assistant', content: streamedResponseContent },
          }).catch(() => {});
        } else {
          await refundQuota();
        }
        return;
      }
      this.logger.error('AI chat error', err?.message || err);
      if (!streamStarted) {
        await failJson(500, 'AI 服务暂时不可用，请稍后重试');
      } else if (!res.writableEnded) {
        // 流已开始则不退额度（上游可能已产生 token）
        const interrupted = '\n\n> AI 输出意外中断，请重试。';
        if (streamedResponseContent.trim() && responseConversationId) {
          streamedResponseContent += interrupted;
          shouldRefund = false;
          res.write(interrupted);
          await this.prisma.aiMessage.create({
            data: { conversationId: responseConversationId, role: 'assistant', content: streamedResponseContent },
          }).catch(() => {});
        } else {
          await refundQuota();
          res.write('AI 服务暂时不可用，请稍后重试。');
        }
        res.end();
      } else {
        await refundQuota();
      }
    } finally {
      if (req) {
        req.removeListener?.('aborted', onClientClose);
      }
      res.removeListener?.('close', onClientClose);
    }
  }
}
