import client from "./client";

export const problemListApi = {
  getPublicLists: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
    client.get("/problem-lists", { params }),

  getMyLists: (params?: { page?: number; pageSize?: number }) =>
    client.get("/problem-lists/mine", { params }),

  getDetail: (id: number) =>
    client.get(`/problem-lists/${id}`),

  create: (data: { title: string; description?: string; isPublic?: boolean }) =>
    client.post("/problem-lists", data),

  update: (id: number, data: { title?: string; description?: string }) =>
    client.patch(`/problem-lists/${id}`, data),

  delete: (id: number) =>
    client.delete(`/problem-lists/${id}`),

  addItems: (id: number, slugs: string[]) =>
    client.post(`/problem-lists/${id}/items`, { slugs }),

  removeItem: (id: number, problemId: number) =>
    client.delete(`/problem-lists/${id}/items/${problemId}`),

  updateSortOrder: (id: number, items: { id: number; sortOrder: number }[]) =>
    client.patch(`/problem-lists/${id}/items/sort`, { items }),
};
