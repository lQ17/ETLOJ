import client from "./client";

export const submissionApi = {
  create: (data: { problemId: number; code: string; language: string }) =>
    client.post("/submissions", data),

  run: (data: { problemId: number; code: string; language: string; input: string }) =>
    client.post("/submissions/run", data),

  list: (params?: {
    page?: number;
    pageSize?: number;
    username?: string;
    problemId?: number;
    keyword?: string;
    status?: string;
  }) => client.get("/submissions", { params }),

  my: (params?: { page?: number; problemId?: number }) =>
    client.get("/submissions/my", { params }),

  getOne: (id: number) => client.get(`/submissions/${id}`),

  cleanDirty: () => client.delete("/submissions/dirty"),

  getStatus: (problemIds: number[]) =>
    client.get("/submissions/status", { params: { problemIds: problemIds.join(",") } }),
};
