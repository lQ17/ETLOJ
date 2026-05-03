import client from "./client";

export const profileApi = {
  /** 获取用户公开主页信息 */
  getProfile: (username: string) =>
    client.get(`/profile/${username}`),

  /** 获取用户统计数据 (图表) */
  getStats: (username: string) =>
    client.get(`/profile/${username}/stats`),
};
