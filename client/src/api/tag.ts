import client from "./client";

export const tagApi = {
  list: () => client.get("/tags"),

  getOne: (id: number) => client.get(`/tags/${id}`),

  create: (data: { name: string; description?: string }) =>
    client.post("/tags", data),

  update: (id: number, data: { name?: string; description?: string }) =>
    client.patch(`/tags/${id}`, data),

  remove: (id: number) => client.delete(`/tags/${id}`),
};
