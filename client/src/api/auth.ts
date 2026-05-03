import client from "./client";

export const authApi = {
  login: (username: string, password: string) =>
    client.post("/auth/login", { username, password }),

  getProfile: () => client.get("/auth/profile"),
};
