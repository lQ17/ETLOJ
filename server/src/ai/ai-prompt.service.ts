import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiPromptService {
  constructor(private providerService: AiProviderService) {}

  async buildSystemPrompt(ctx: {
    title: string;
    difficulty: string;
    markdown: string;
    currentCode?: string;
    submissions: { status: string; score: number | null; createdAt: Date; language?: string; code?: string }[];
    language?: string;
    promptConfigId?: number;
  }): Promise<string> {
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

    let promptConfig: { role: string; codeRules: string; replyRules: string };
    if (ctx.promptConfigId) {
      const found = await this.providerService.getPromptConfigById(ctx.promptConfigId);
      promptConfig = found ?? await this.providerService.getActivePromptConfig();
    } else {
      promptConfig = await this.providerService.getActivePromptConfig();
    }

    let prompt = `${promptConfig.role}

${promptConfig.codeRules}

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

    // 最近非 AC 提交的代码摘要（最多 3 条，便于「分析错误」）
    const recentFailed = ctx.submissions
      .filter((sub) => sub.status !== 'AC' && sub.code?.trim())
      .slice(0, 3);
    if (recentFailed.length > 0) {
      prompt += `\n### 最近提交详情\n`;
      recentFailed.forEach((sub, i) => {
        const code = (sub.code || '').length > 1500
          ? (sub.code || '').slice(0, 1500) + '\n// ...(代码已截断)'
          : (sub.code || '');
        const lang = sub.language || ctx.language || '';
        const scorePart = sub.score != null ? `，得分 ${sub.score}` : '';
        prompt += `\n#### 提交 #${i + 1}：${sub.status}${scorePart}${lang ? `（${lang}）` : ''}\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
      });
    }

    if (ctx.language) {
      const langLabelMap: Record<string, string> = {
        c: 'C',
        cpp: 'C++',
        java: 'Java',
        python: 'Python',
      };
      const langName = langLabelMap[ctx.language] || ctx.language;
      prompt += `\n## 编程语言要求\n- 学生当前使用的编程语言为：**${langName}**，你必须用此语言进行解答与分析。\n`;

      if (ctx.language === 'cpp') {
        prompt += `- 对于 C++ 代码，默认使用以下代码结构和头文件：\n\`\`\`cpp\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n\`\`\`\n- 默认编译器配置为 **g++14** (C++14)，请在此标准下提供指导和建议。\n`;
      }
    }

    prompt += `\n${promptConfig.replyRules}\n`;

    return prompt;
  }
}
