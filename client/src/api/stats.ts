import client from "./client";

export const statsApi = {
  getPlatform: () => client.get("/stats"),
};
