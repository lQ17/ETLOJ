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

  /** 按用户名关键字搜索参与排名的用户 */
  searchUsers: (keyword: string) =>
    client.get("/ranking/search", { params: { keyword } }),
};
