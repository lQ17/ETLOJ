import client from "./client";

export const submissionApi = {
  create: (data: { problemId: number; code: string; language: string }) =>
    client.post("/submissions", data),

  list: (params?: { page?: number; problemId?: number; userId?: number }) =>
    client.get("/submissions", { params }),

  my: (params?: { page?: number; problemId?: number }) =>
    client.get("/submissions/my", { params }),

  getOne: (id: number) => client.get(`/submissions/${id}`),
};
