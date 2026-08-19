import { NotFoundException } from '@nestjs/common';
import { AiConversationService } from './ai-conversation.service';

describe('AiConversationService problem visibility', () => {
  const prisma = {
    problem: { findFirst: jest.fn() },
    submission: { findMany: jest.fn() },
    aiConversation: { findUnique: jest.fn(), deleteMany: jest.fn() },
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
});
