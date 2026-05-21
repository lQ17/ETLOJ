import client from './client';

export const aiApi = {
  /** 获取当前用户剩余 AI 使用次数 */
  getRemaining: () => client.get('/ai/remaining'),

  /** 获取聊天记录 */
  getHistory: (problemId: number) => client.get(`/ai/chat/history`, { params: { problemId } }),

  /** 清空聊天记录 */
  clearHistory: (problemId: number) => client.delete(`/ai/chat/history`, { params: { problemId } }),

  /** 获取提示词配置列表（登录用户） */
  getPromptConfigs: () => client.get('/ai/prompt-configs'),
};
