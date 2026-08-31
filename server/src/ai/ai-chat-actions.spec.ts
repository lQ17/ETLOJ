import { AiConversationService } from './ai-conversation.service';

describe('AiConversationService action pipeline', () => {
  it('isolates idea context and forwards only final content, including a final SSE line without newline', async () => {
    const prisma = {
      problem: { findFirst: jest.fn().mockResolvedValue({
        id: 2,
        title: 'P',
        difficulty: 'IRON',
        filePath: 'missing.md',
        timeLimit: 1000,
        memoryLimit: 256,
      }) },
      submission: { findMany: jest.fn(), findFirst: jest.fn() },
      aiConversation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 11 }),
      },
      aiMessage: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([{ role: 'user', content: '给思路' }]),
      },
      aiUsageLog: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    const redis = {
      incr: jest.fn(),
      ttl: jest.fn().mockResolvedValue(100),
      expire: jest.fn(),
      incrBy: jest.fn(),
    };
    const provider = {
      getActiveProvider: jest.fn().mockResolvedValue({
        id: 1,
        name: 'test',
        apiBase: 'http://model.test/v1',
        apiKey: 'key',
        modelName: 'model',
      }),
    };
    const quota = {
      checkAndIncrementUsage: jest.fn().mockResolvedValue(true),
      decrementUsage: jest.fn(),
      getRedis: jest.fn().mockReturnValue(redis),
    };
    const prompt = { buildSystemPrompt: jest.fn().mockResolvedValue('SYSTEM') };
    const service = new AiConversationService(prisma as any, provider as any, quota as any, prompt as any);
    const output: string[] = [];
    const res = {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn((chunk: string) => output.push(chunk)),
      end: jest.fn(function (this: any) { this.writableEnded = true; }),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"reasoning_content":"PRIVATE"}}]}\n\n' +
      'data:{"choices":[{"delta":{"content":"FINAL"}}]}',
      { status: 200 },
    ));
    try {
      await service.chat(
        { id: 7, role: 'USER' },
        { problemId: 2, action: 'IDEA', messages: [{ role: 'user', content: '给思路' }] },
        res,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(prompt.buildSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IDEA',
      currentCode: undefined,
      submissions: [],
    }));
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
    expect(output.join('')).toBe('FINAL');
    expect(output.join('')).not.toContain('PRIVATE');
    expect(prisma.aiMessage.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ role: 'user', action: 'IDEA' }),
    });
    expect(prisma.aiMessage.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ role: 'assistant', content: 'FINAL' }),
    });
  });
});
