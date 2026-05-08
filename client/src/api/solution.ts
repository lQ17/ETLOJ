import client from "./client";

export const solutionApi = {
  list: (problemId: number) =>
    client.get("/solutions", { params: { problemId } }),

  mine: () => client.get("/solutions/mine"),

  getOne: (id: number) => client.get(`/solutions/${id}`),

  create: (data: { problemId: number; content: string }) =>
    client.post("/solutions", data),

  update: (id: number, content: string) =>
    client.patch(`/solutions/${id}`, { content }),

  delete: (id: number) => client.delete(`/solutions/${id}`),
};
