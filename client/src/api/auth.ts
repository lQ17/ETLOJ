import client from "./client";

export const authApi = {
  login: (account: string, password: string) =>
    client.post("/auth/login", { account, password }),

  getProfile: () => client.get("/auth/profile"),
  
  register: (data: any) => client.post("/auth/register", data),
  reapply: (data: any) => client.post("/auth/reapply", data),
};
