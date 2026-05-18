import client from "./client";

export const adminAiApi = {
  getProviders: () => client.get('/ai/admin/providers'),
  addProvider: (data: any) => client.post('/ai/admin/providers', data),
  updateProvider: (id: number, data: any) => client.patch(`/ai/admin/providers/${id}`, data),
  deleteProvider: (id: number) => client.delete(`/ai/admin/providers/${id}`),
  activateProvider: (id: number) => client.post(`/ai/admin/providers/${id}/activate`),
  getUsersQuotas: (params: any) => client.get('/ai/admin/users/quotas', { params }),
  updateUserQuota: (id: number, aiDailyLimit: number | null) => client.patch(`/ai/admin/users/${id}/quota`, { aiDailyLimit }),
  setGlobalLimit: (dailyLimit: number) => client.patch('/ai/admin/config/global-limit', { dailyLimit }),
  getStats: () => client.get('/ai/admin/stats'),
  fetchAvailableModels: (apiBase: string, apiKey: string) => client.post('/ai/admin/providers/fetch-models', { apiBase, apiKey }),
};
