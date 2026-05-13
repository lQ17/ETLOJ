import client from "./client";

export const announcementApi = {
  list: (params: { page?: number; pageSize?: number }) =>
    client.get("/announcements", { params }),

  getById: (id: number) => client.get(`/announcements/${id}`),

  adminGetById: (id: number) => client.get(`/announcements/admin/${id}`),

  adminList: (params: { status?: string; page?: number; pageSize?: number }) =>
    client.get("/announcements/admin/all", { params }),

  create: (data: { title: string; summary: string; content?: string; isPinned?: boolean; status?: string }) =>
    client.post("/announcements", data),

  update: (id: number, data: { title?: string; summary?: string; content?: string; isPinned?: boolean; status?: string }) =>
    client.patch(`/announcements/${id}`, data),

  remove: (id: number) => client.delete(`/announcements/${id}`),
};
