import client from "./client";

export const rankingApi = {
  /** 获取排名列表 */
  getRanking: (params?: {
    mode?: string;
    range?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => client.get("/ranking", { params }),
};
