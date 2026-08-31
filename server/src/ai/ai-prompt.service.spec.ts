import { AiPromptService } from './ai-prompt.service';

describe('AiPromptService action-specific context', () => {
  const provider = {
    getPromptConfigById: jest.fn(),
    getActivePromptConfig: jest.fn().mockResolvedValue({
      role: 'ROLE',
      codeRules: 'CODE_RULES',
      replyRules: 'REPLY_RULES',
    }),
  };
  const service = new AiPromptService(provider as any);

  beforeEach(() => jest.clearAllMocks());

  const base = {
    title: '测试题',
    difficulty: 'SILVER',
    markdown: '题面与约束',
    timeLimit: 1500,
    memoryLimit: 256,
    submissions: [],
  };

  it('keeps idea prompts independent from editor code and submissions', async () => {
    const prompt = await service.buildSystemPrompt({
      ...base,
      action: 'IDEA',
      currentCode: 'SECRET_EDITOR_CODE',
      language: 'cpp',
      submissions: [{
        id: 1,
        status: 'WA',
        score: 0,
        timeUsed: 1,
        memoryUsed: 2,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        code: 'OLD_FAILED_CODE',
      }],
    });

    expect(prompt).toContain('本轮任务：解题思路');
    expect(prompt).toContain('时间限制：1500 ms');
    expect(prompt).not.toContain('SECRET_EDITOR_CODE');
    expect(prompt).not.toContain('OLD_FAILED_CODE');
  });

  it('uses only the target submission for error analysis', async () => {
    const prompt = await service.buildSystemPrompt({
      ...base,
      action: 'ANALYZE_ERROR',
      currentCode: 'CURRENT_CPP_CODE',
      language: 'cpp',
      targetSubmission: {
        id: 42,
        status: 'CE',
        score: 0,
        timeUsed: 0,
        memoryUsed: 0,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        language: 'python',
        code: 'print(missing_name)',
        diagnostic: 'NameError',
        testcases: [{ status: 'CE', timeUsed: 0, memoryUsed: 0 }],
      },
    });

    expect(prompt).toContain('提交 ID：42');
    expect(prompt).toContain('语言：Python');
    expect(prompt).toContain('NameError');
    expect(prompt).toContain('print(missing_name)');
    expect(prompt).not.toContain('CURRENT_CPP_CODE');
  });

  it('uses the real C++17 judge standard for optimization', async () => {
    const prompt = await service.buildSystemPrompt({
      ...base,
      action: 'OPTIMIZE',
      currentCode: 'int main() {}',
      language: 'cpp',
    });

    expect(prompt).toContain('本轮任务：优化当前代码');
    expect(prompt).toContain('C++17');
    expect(prompt).not.toContain('g++14');
  });
});
