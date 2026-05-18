import client from './client';

export const aiApi = {
  /** 获取当前用户剩余 AI 使用次数 */
  getRemaining: () => client.get('/ai/remaining'),

  /** 获取 AI 配置（管理员） */
  getConfig: () => client.get('/ai/config'),

  /** 更新 AI 配置（管理员） */
  updateConfig: (data: { apiBase?: string; apiKey?: string; model?: string; dailyLimit?: number }) =>
    client.patch('/ai/config', data),

  /** 获取聊天记录 */
  getHistory: (problemId: number) => client.get(`/ai/chat/history`, { params: { problemId } }),

  /** 清空聊天记录 */
  clearHistory: (problemId: number) => client.delete(`/ai/chat/history`, { params: { problemId } }),
};
