import client from "./client";

export const problemApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    difficulty?: string;
    keyword?: string;
  }) => client.get("/problems", { params }),

  getOne: (idOrSlug: number | string) => client.get(`/problems/${idOrSlug}`),

  getMarkdown: (id: number) =>
    client.get(`/problems/${id}/markdown`, { transformResponse: [(data: string) => data] }),

  create: (data: {
    slug: string;
    title: string;
    difficulty?: string;
    timeLimit?: number;
    memoryLimit?: number;
    tags?: string[];
    markdown: string;
  }) => client.post("/problems", data),

  update: (id: number, data: Record<string, any>) =>
    client.patch(`/problems/${id}`, data),

  delete: (id: number) => client.delete(`/problems/${id}`),

  saveTestcases: (
    id: number,
    testcases: { input: string; output: string }[]
  ) => client.post(`/problems/${id}/testcases`, { testcases }),

  getTestcases: (id: number) => client.get(`/problems/${id}/testcases`),
};
