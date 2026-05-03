import client from "./client";

export const userApi = {
  create: (data: { username: string; email?: string; phone?: string; password?: string; role?: string }) =>
    client.post("/users", data),

  list: (params?: { page?: number; pageSize?: number; keyword?: string; role?: string; isActive?: boolean }) =>
    client.get("/users", { params }),

  getOne: (id: number) => client.get(`/users/${id}`),

  update: (id: number, data: { username?: string; email?: string; phone?: string; password?: string; role?: string; isActive?: boolean }) =>
    client.patch(`/users/${id}`, data),

  remove: (id: number) => client.delete(`/users/${id}`),

  toggleActive: (id: number) => client.patch(`/users/${id}/toggle-active`),

  updateProfile: (data: { email?: string; phone?: string; avatar?: string; signature?: string }) =>
    client.patch("/users/me/profile", data),

  updateSecurity: (data: { oldPassword?: string; newPassword?: string }) =>
    client.patch("/users/me/security", data),
};
