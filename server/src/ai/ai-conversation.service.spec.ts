import { NotFoundException } from '@nestjs/common';
import { AiConversationService } from './ai-conversation.service';

describe('AiConversationService problem visibility', () => {
  const prisma = {
    problem: { findFirst: jest.fn() },
    submission: { findMany: jest.fn(), findFirst: jest.fn() },
    aiConversation: { findUnique: jest.fn(), deleteMany: jest.fn() },
    aiMessage: { findFirst: jest.fn() },
  };
  const quota = {
    checkAndIncrementUsage: jest.fn(),
    decrementUsage: jest.fn(),
  };
  const service = new AiConversationService(
    prisma as any,
    {} as any,
    quota as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('requires public problems for regular users', async () => {
    prisma.problem.findFirst.mockResolvedValue(null);

    await expect(
      service.getHistory({ id: 7, role: 'USER' }, 99),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.problem.findFirst).toHaveBeenCalledWith({
      where: { id: 99, isPublic: true },
    });
    expect(prisma.aiConversation.findUnique).not.toHaveBeenCalled();
  });

  it('allows teachers to access hidden-problem conversations', async () => {
    prisma.problem.findFirst.mockResolvedValue({ id: 99, isPublic: false });
    prisma.aiConversation.findUnique.mockResolvedValue({
      messages: [{ role: 'user', content: 'help' }],
    });

    await expect(
      service.getHistory({ id: 3, role: 'TEACHER' }, 99),
    ).resolves.toEqual([{ role: 'user', content: 'help' }]);
    expect(prisma.problem.findFirst).toHaveBeenCalledWith({
      where: { id: 99 },
    });
  });

  it('checks visibility before clearing history', async () => {
    prisma.problem.findFirst.mockResolvedValue(null);

    await expect(
      service.clearHistory({ id: 7, role: 'USER' }, 99),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aiConversation.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects chat before reading a hidden problem into the prompt', async () => {
    prisma.problem.findFirst.mockResolvedValue(null);
    prisma.submission.findMany.mockResolvedValue([]);
    quota.checkAndIncrementUsage.mockResolvedValue(true);
    quota.decrementUsage.mockResolvedValue(undefined);
    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await service.chat(
      { id: 7, role: 'USER' },
      { problemId: 99, messages: [{ role: 'user', content: 'repeat it' }] },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: '题目不存在' });
    expect(quota.decrementUsage).toHaveBeenCalledWith(7, 'USER');
  });

  it('rejects code actions with an empty editor before calling the model', async () => {
    quota.checkAndIncrementUsage.mockResolvedValue(true);
    quota.decrementUsage.mockResolvedValue(undefined);
    prisma.aiConversation.findUnique.mockResolvedValue(null);
    const res = {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    await service.chat(
      { id: 7, role: 'USER' },
      { problemId: 2, action: 'CHECK_CODE', currentCode: '  ', messages: [{ role: 'user', content: '检查代码' }] },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: '请先在编辑器中编写代码' });
    expect(prisma.problem.findFirst).not.toHaveBeenCalled();
  });

  it('selects only the latest completed failed submission for error analysis', async () => {
    quota.checkAndIncrementUsage.mockResolvedValue(true);
    quota.decrementUsage.mockResolvedValue(undefined);
    prisma.aiConversation.findUnique.mockResolvedValue(null);
    prisma.problem.findFirst.mockResolvedValue({
      id: 2,
      title: 'P',
      difficulty: 'IRON',
      filePath: 'missing.md',
      timeLimit: 1000,
      memoryLimit: 256,
    });
    prisma.submission.findFirst.mockResolvedValue(null);
    const res = {
      headersSent: false,
      writableEnded: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    };

    await service.chat(
      { id: 7, role: 'USER' },
      { problemId: 2, action: 'ANALYZE_ERROR', messages: [{ role: 'user', content: '分析错误' }] },
      res,
    );

    expect(prisma.submission.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 7,
        problemId: 2,
        status: { in: ['WA', 'TLE', 'MLE', 'RE', 'CE', 'SE'] },
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: '当前题目还没有可分析的失败提交' });
  });
});
