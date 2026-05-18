import request from "./request";

export const adminAiApi = {
  getProviders: () => request.get('/ai/admin/providers'),
  addProvider: (data: any) => request.post('/ai/admin/providers', data),
  updateProvider: (id: number, data: any) => request.patch(`/ai/admin/providers/${id}`, data),
  deleteProvider: (id: number) => request.delete(`/ai/admin/providers/${id}`),
  activateProvider: (id: number) => request.post(`/ai/admin/providers/${id}/activate`),
  getUsersQuotas: (params: any) => request.get('/ai/admin/users/quotas', { params }),
  updateUserQuota: (id: number, aiDailyLimit: number | null) => request.patch(`/ai/admin/users/${id}/quota`, { aiDailyLimit }),
  setGlobalLimit: (dailyLimit: number) => request.patch('/ai/admin/config/global-limit', { dailyLimit }),
  getStats: () => request.get('/ai/admin/stats'),
};
