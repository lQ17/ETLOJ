import client from "./client";

export interface McpRateLimitConfig {
  globalRateLimitMax: number;
  globalRateLimitWindowMs: number;
  adminWriteRateLimitMax: number;
  adminWriteRateLimitWindowMs: number;
}

export const mcpAdminApi = {
  getRateLimits: () =>
    client.get("/mcp/admin/rate-limits") as Promise<McpRateLimitConfig>,

  updateRateLimits: (config: McpRateLimitConfig) =>
    client.patch("/mcp/admin/rate-limits", config) as Promise<McpRateLimitConfig>,
};
