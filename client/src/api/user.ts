import client from "./client";

export const userApi = {
  create: (data: { username: string; email: string; password: string; role?: string }) =>
    client.post("/users", data),
};
