import client from "./client";
import type { DifficultyLevel } from "../constants/difficulty";

export const problemApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    difficulty?: DifficultyLevel;
    keyword?: string;
    tags?: string[];
    tagMode?: "AND" | "OR";
  }) => client.get("/problems", { params }),

  getOne: (idOrSlug: number | string) => client.get(`/problems/${idOrSlug}`),

  getMarkdown: (id: number) =>
    client.get(`/problems/${id}/markdown`, { transformResponse: [(data: string) => data] }),

  create: (data: {
    slug: string;
    title: string;
    difficulty?: DifficultyLevel;
    timeLimit?: number;
    memoryLimit?: number;
    tags?: string[];
    markdown: string;
    score?: number;
  }) => client.post("/problems", data),

  update: (id: number, data: Record<string, any>) =>
    client.patch(`/problems/${id}`, data),

  delete: (id: number) => client.delete(`/problems/${id}`),

  saveTestcases: (
    id: number,
    testcases: { input: string; output: string }[]
  ) => client.post(`/problems/${id}/testcases`, { testcases }),

  getTestcases: (id: number) => client.get(`/problems/${id}/testcases`),

  deleteTestcase: (id: number, num: number) => client.delete(`/problems/${id}/testcases/${num}`),

  exportProblems: (slugs: string[]) =>
    client.post("/problems/export", { slugs }, { responseType: "blob" }),

  exportAllProblems: () =>
    client.post("/problems/export-all", {}, { responseType: "blob" }),

  importProblems: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return client.post("/problems/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
