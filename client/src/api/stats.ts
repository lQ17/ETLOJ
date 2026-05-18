import client from "./client";

export const statsApi = {
  getPlatform: () => client.get("/stats"),
  getAiStats: () => client.get("/ai/stats/public"),
};
