import client from "./client";

export const mcpOAuthApi = {
  authorize: (body: Record<string, string | boolean>) =>
    client.post("/mcp-oauth/authorize", body) as Promise<{
      redirect_uri: string;
    }>,
};
