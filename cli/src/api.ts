import type { ApiConfig } from "./types.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
};

function appendQuery(url: URL, query: RequestOptions["query"]): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

function errorMessage(body: unknown, statusCode: number): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (message) return message;
  }
  return `请求失败（HTTP ${statusCode}）`;
}

export class EtlojApi {
  constructor(private readonly config: ApiConfig) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.config.apiUrl}/${path.replace(/^\/+/, "")}`);
    appendQuery(url, options.query);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.config.token) headers.Authorization = `Bearer ${this.config.token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new ApiError(`无法连接服务器：${error instanceof Error ? error.message : String(error)}`, 0, error);
    }

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => undefined)
      : await response.text();

    if (!response.ok) throw new ApiError(errorMessage(body, response.status), response.status, body);
    return body as T;
  }
}
