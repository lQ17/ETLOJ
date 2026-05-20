export const DEFAULT_MARKDOWN = `## 题目描述\n\n输入两个整数 $a$ 和 $b$，输出它们的和。\n\n## 输入格式\n\n一行两个整数 $a, b$。\n\n## 输出格式\n\n一行一个整数。\n\n## 输入输出样例 #1\n\n### 输入 #1\n\n\`\`\`\n1 2\n\`\`\`\n\n### 输出 #1\n\n\`\`\`\n3\n\`\`\`\n\n## 说明/提示\n\n$-10^9 \\leq a, b \\leq 10^9$\n`;

export interface TestCase {
  id: string;
  name: string;
  input: string;
  output: string;
}
