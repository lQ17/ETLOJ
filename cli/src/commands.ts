import { input, password } from "@inquirer/prompts";
import type { Command } from "commander";
import { clearToken, getConfigFilePath, loadConfig, saveConfig } from "./config.js";
import { ApiError, EtlojApi } from "./api.js";
import { getField, printFormatted, printJson, printLibraryDetail, printLibraryList, printProblemDetail, printProblemList, printProblemStatus, printTags } from "./output.js";
import type { LibraryDetail, LibrarySummary, OutputFormat, ProblemDetail, ProblemListResponse, ProblemListItem, ProblemStats, ProblemStatusResult, ProblemSummary, Tag } from "./types.js";

function formatOption(value: string | undefined): OutputFormat {
  const format = value || "table";
  if (!["table", "json", "ndjson", "markdown"].includes(format)) {
    throw new Error(`不支持的输出格式：${format}`);
  }
  return format as OutputFormat;
}

function positiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} 必须是正整数`);
  return parsed;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

async function api(): Promise<EtlojApi> {
  return new EtlojApi(await loadConfig());
}

export type ProblemListOptions = {
  page?: string;
  pageSize?: string;
  difficulty?: string;
  keyword?: string;
  content?: string;
  tag?: string[];
  tagMode?: "AND" | "OR";
  searchIn?: "title" | "content" | "all";
  all?: boolean;
  limit?: string;
  format?: string;
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_ALL_LIMIT = 1000;
const MAX_ALL_LIMIT = 5000;

function statsFromListItem(item: ProblemListItem): ProblemStats {
  if (item.stats) return item.stats;
  const totalSubmissions = item.totalSubmissions || 0;
  const acceptedSubmissions = item.acceptedCount || 0;
  return {
    totalSubmissions,
    acceptedSubmissions,
    acceptanceRate: totalSubmissions === 0 ? 0 : acceptedSubmissions / totalSubmissions,
  };
}

function toListSummary(item: ProblemListItem): ProblemSummary {
  return {
    slug: item.slug,
    title: item.title,
    timeLimit: item.timeLimit,
    memoryLimit: item.memoryLimit,
    score: item.score,
    tags: item.tags || [],
    stats: statsFromListItem(item),
  };
}

function toProblemSummary(problem: ProblemDetail): ProblemSummary {
  return {
    slug: problem.slug,
    title: problem.title,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    score: problem.score,
    markdown: problem.markdown,
    tags: problem.tags,
    stats: problem.stats,
  };
}

async function fetchProblemPages(client: EtlojApi, options: ProblemListOptions): Promise<ProblemListResponse> {
  const pageSize = positiveInt(options.pageSize || "20", "page-size");
  if (pageSize > MAX_PAGE_SIZE) throw new Error(`page-size 不能超过 ${MAX_PAGE_SIZE}`);
  const firstPage = positiveInt(options.page || "1", "page");
  const query = {
    pageSize,
    difficulty: options.difficulty,
    keyword: options.keyword,
    content: options.content,
    tags: options.tag,
    tagMode: options.tagMode,
  };

  if (!options.all) {
    return client.request<ProblemListResponse>("problems", { query: { ...query, page: firstPage } });
  }

  const items: ProblemListItem[] = [];
  const limit = positiveInt(options.limit || String(DEFAULT_ALL_LIMIT), "limit");
  if (limit > MAX_ALL_LIMIT) throw new Error(`limit 不能超过 ${MAX_ALL_LIMIT}`);
  let page = firstPage;
  let total = 0;
  while (items.length < Math.min(total || Number.POSITIVE_INFINITY, limit) || page === firstPage) {
    const result = await client.request<ProblemListResponse>("problems", { query: { ...query, page } });
    items.push(...result.items.slice(0, Math.max(0, limit - items.length)));
    total = result.total;
    if (result.items.length === 0 || items.length >= total || items.length >= limit) break;
    page += 1;
  }
  return { items, total, page: firstPage, pageSize, truncated: items.length < total };
}

export function buildProblemQuery(options: ProblemListOptions, keywordOverride?: unknown): Record<string, unknown> {
  const searchIn = options.searchIn || "title";
  const searchKeyword = typeof keywordOverride === "string" ? keywordOverride : options.keyword;
  return {
    pageSize: positiveInt(options.pageSize || "20", "page-size"),
    difficulty: options.difficulty,
    keyword: searchIn === "content" ? undefined : searchKeyword,
    content: searchIn === "content" ? searchKeyword : searchIn === "all" ? searchKeyword : options.content,
    tags: options.tag,
    tagMode: options.tagMode,
  };
}

async function runProblemList(options: ProblemListOptions, keywordOverride?: unknown): Promise<void> {
  const client = await api();
  const query = buildProblemQuery(options, keywordOverride);
  const result = await fetchProblemPages(client, {
    ...options,
    keyword: query.keyword as string | undefined,
    content: query.content as string | undefined,
  });
  const compactResult = { ...result, items: result.items.map(toListSummary) };
  const format = formatOption(options.format);
  if (format === "markdown") throw new Error("题目列表不支持 markdown 输出");
  if (format === "json") return printJson(compactResult);
  if (format === "ndjson") return printFormatted(compactResult, format, () => undefined);
  printProblemList(compactResult);
}

async function runProblemGet(identifier: string, options: { format?: string; field?: string; full?: boolean }): Promise<void> {
  const client = await api();
  const problem = await client.request<ProblemDetail>(`problems/${encodeURIComponent(identifier)}`);
  const view = options.full ? problem : toProblemSummary(problem);
  if (options.field) {
    const field = getField(view, options.field);
    if (typeof field === "string") process.stdout.write(`${field}\n`);
    else printJson(field);
    return;
  }

  const format = formatOption(options.format);
  if (format === "markdown") {
    process.stdout.write(`${problem.markdown}\n`);
    return;
  }
  if (format === "json") return printJson(view);
  if (format === "ndjson") return printFormatted(view, format, () => undefined);
  printProblemDetail(view);
}

async function runProblemMarkdown(identifier: string): Promise<void> {
  const client = await api();
  const markdown = await client.request<string>(`problems/${encodeURIComponent(identifier)}/markdown`);
  process.stdout.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
}

async function runProblemStatus(identifier: string, options: { format?: string }): Promise<void> {
  const config = await loadConfig();
  if (!config.token) throw new Error("查询个人通过状态需要先登录：etloj auth login");

  const client = new EtlojApi(config);
  const problem = await client.request<ProblemDetail>(`problems/${encodeURIComponent(identifier)}`);
  const statuses = await client.request<Record<string, string>>("submissions/status", {
    query: { problemIds: problem.id },
  });
  const status = statuses[String(problem.id)] === "AC"
    ? "AC"
    : statuses[String(problem.id)] === "ATTEMPTED"
      ? "ATTEMPTED"
      : "NOT_ATTEMPTED";
  const result: ProblemStatusResult = {
    slug: problem.slug,
    title: problem.title,
    status,
    passed: status === "AC",
  };
  const format = formatOption(options.format);
  if (format === "json") return printJson(result);
  if (format === "ndjson") return printFormatted(result, format, () => undefined);
  if (format !== "table") throw new Error("通过状态只支持 table、json 或 ndjson 输出");
  printProblemStatus(result);
}

type LibraryListOptions = {
  page?: string;
  pageSize?: string;
  keyword?: string;
  all?: boolean;
  limit?: string;
  format?: string;
};

type RawLibraryList = {
  id: number;
  title: string;
  description?: string | null;
  creator?: { id: number; username: string } | null;
  _count?: { items: number };
  acCount?: number;
  createdAt: string;
  updatedAt: string;
};

function toLibrarySummary(item: RawLibraryList): LibrarySummary {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    creator: item.creator,
    problemCount: item._count?.items || 0,
    acCount: item.acCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function fetchLibraries(client: EtlojApi, options: LibraryListOptions): Promise<{ items: LibrarySummary[]; total: number; page: number; pageSize: number; truncated?: boolean }> {
  const pageSize = positiveInt(options.pageSize || "20", "page-size");
  if (pageSize > MAX_PAGE_SIZE) throw new Error(`page-size 不能超过 ${MAX_PAGE_SIZE}`);
  const firstPage = 1;
  const query = { pageSize, keyword: options.keyword };
  if (!options.all) {
    const result = await client.request<{ items: RawLibraryList[]; total: number; page: number; pageSize: number }>("problem-lists", {
      query: { ...query, page: firstPage },
    });
    return { ...result, items: result.items.map(toLibrarySummary) };
  }

  const limit = positiveInt(options.limit || String(DEFAULT_ALL_LIMIT), "limit");
  if (limit > MAX_ALL_LIMIT) throw new Error(`limit 不能超过 ${MAX_ALL_LIMIT}`);
  const items: LibrarySummary[] = [];
  let page = firstPage;
  let total = 0;
  while (items.length < Math.min(total || Number.POSITIVE_INFINITY, limit) || page === firstPage) {
    const result = await client.request<{ items: RawLibraryList[]; total: number; page: number; pageSize: number }>("problem-lists", {
      query: { ...query, page },
    });
    items.push(...result.items.map(toLibrarySummary).slice(0, Math.max(0, limit - items.length)));
    total = result.total;
    if (result.items.length === 0 || items.length >= total || items.length >= limit) break;
    page += 1;
  }
  return { items, total, page: firstPage, pageSize, truncated: items.length < total };
}

async function runLibraryList(options: LibraryListOptions, keywordOverride?: string): Promise<void> {
  const client = await api();
  const result = await fetchLibraries(client, { ...options, keyword: keywordOverride ?? options.keyword });
  const format = formatOption(options.format);
  if (format === "json") return printJson(result);
  if (format === "ndjson") return printFormatted(result, format, () => undefined);
  if (format !== "table") throw new Error("题库列表只支持 table、json 或 ndjson 输出");
  printLibraryList(result);
}

async function runLibraryGet(id: string, options: { format?: string }): Promise<void> {
  const client = await api();
  const library = await client.request<LibraryDetail>(`problem-lists/${encodeURIComponent(id)}`);
  const format = formatOption(options.format);
  if (format === "json") return printJson(library);
  if (format === "ndjson") return printFormatted(library, format, () => undefined);
  if (format !== "table") throw new Error("题库详情只支持 table、json 或 ndjson 输出");
  printLibraryDetail(library);
}

export function registerCommands(program: Command): void {
  const config = program.command("config").description("管理 CLI 配置");
  config.command("set").command("api-url <url>").action(async (url: string) => {
    try {
      new URL(url);
    } catch {
      throw new Error("api-url 必须是有效的 URL");
    }
    await saveConfig({ apiUrl: url });
    console.log(`已设置 API 地址：${url.replace(/\/+$/, "")}`);
  });
  config.command("get").action(async () => {
    const current = await loadConfig();
    printJson({ apiUrl: current.apiUrl, configFile: getConfigFilePath(), hasToken: Boolean(current.token) });
  });

  const auth = program.command("auth").description("管理登录状态");
  auth.command("login").option("--account <account>", "用户名、邮箱或手机号").action(async (options: { account?: string }) => {
    const account = options.account || process.env.ETLOJ_ACCOUNT || await input({ message: "账号：" });
    const userPassword = process.env.ETLOJ_PASSWORD || await password({ message: "密码：", mask: "*" });
    const client = await api();
    const result = await client.request<{ access_token: string; user?: { username?: string } }>("auth/login", {
      method: "POST",
      body: { account, password: userPassword },
    });
    await saveConfig({ token: result.access_token });
    console.log(`登录成功${result.user?.username ? `：${result.user.username}` : ""}`);
  });
  auth.command("status").action(async () => {
    const current = await loadConfig();
    if (!current.token) {
      console.log("当前未登录");
      return;
    }
    const profile = await new EtlojApi(current).request<{ username: string; role: string }>("auth/profile");
    console.log(`已登录：${profile.username}（${profile.role}）`);
  });
  auth.command("logout").action(async () => {
    await clearToken();
    console.log("已退出登录");
  });

  const problem = program.command("problem").alias("p").description("查询题目");
  problem.command("list")
    .option("--page <number>", "页码", "1")
    .option("--page-size <number>", "每页数量", "20")
    .option("--difficulty <difficulty>")
    .option("--keyword <keyword>")
    .option("--tag <tag>", "标签，可重复使用", collect, [])
    .option("--tag-mode <mode>", "AND 或 OR", "OR")
    .option("--all", "获取全部结果")
    .option("--format <format>", "table、json 或 ndjson", "table")
    .option("--content <text>", "直接按题面内容模糊匹配")
    .option("--limit <number>", "--all 时最多返回数量", String(DEFAULT_ALL_LIMIT))
    .action((options: ProblemListOptions) => runProblemList(options));
  problem.command("search <keyword>")
    .option("--page-size <number>", "每页数量", "20")
    .option("--difficulty <difficulty>")
    .option("--in <field>", "title、content 或 all", "title")
    .option("--tag <tag>", "标签，可重复使用", collect, [])
    .option("--tag-mode <mode>", "AND 或 OR", "OR")
    .option("--all", "获取全部结果")
    .option("--limit <number>", "--all 时最多返回数量", String(DEFAULT_ALL_LIMIT))
    .option("--format <format>", "table、json 或 ndjson", "table")
    .action((keyword: string, options: ProblemListOptions & { in?: "title" | "content" | "all" }) =>
      runProblemList({ ...options, searchIn: options.in }, keyword));
  problem.command("get <idOrSlug>")
    .option("--format <format>", "table、json 或 markdown", "table")
    .option("--full", "输出服务端返回的完整详情")
    .option("--field <field>", "提取字段，例如 stats.acceptanceRate")
    .action(runProblemGet);
  problem.command("markdown <idOrSlug>").action(runProblemMarkdown);
  problem.command("status <idOrSlug>")
    .alias("passed")
    .description("查询当前账号是否通过题目")
    .option("--format <format>", "table、json 或 ndjson", "table")
    .action(runProblemStatus);

  const library = program.command("library").alias("problem-list").description("查询公开题库和个人创建的公开题库");
  library.command("list")
    .option("--page-size <number>", "每页数量", "20")
    .option("--keyword <keyword>", "按题库标题搜索")
    .option("--all", "获取全部结果")
    .option("--limit <number>", "--all 时最多返回数量", String(DEFAULT_ALL_LIMIT))
    .option("--format <format>", "table、json 或 ndjson", "table")
    .action((options: LibraryListOptions) => runLibraryList(options));
  library.command("search <keyword>")
    .option("--page-size <number>", "每页数量", "20")
    .option("--all", "获取全部结果")
    .option("--limit <number>", "--all 时最多返回数量", String(DEFAULT_ALL_LIMIT))
    .option("--format <format>", "table、json 或 ndjson", "table")
    .action((keyword: string, options: LibraryListOptions) => runLibraryList(options, keyword));
  library.command("get <id>")
    .option("--format <format>", "table、json 或 ndjson", "table")
    .action(runLibraryGet);

  const tag = program.command("tag").alias("tags").description("查询标签");
  tag.command("list").option("--format <format>", "table 或 json", "table").action(async (options: { format?: string }) => {
    const tags = await (await api()).request<Tag[]>("tags");
    const format = formatOption(options.format);
    if (format === "json") return printJson(tags);
    if (format !== "table") throw new Error("标签只支持 table 或 json 输出");
    printTags(tags);
  });

  program.command("stats").description("查询平台统计").option("--format <format>", "table 或 json", "table").action(async (options: { format?: string }) => {
    const stats = await (await api()).request<Record<string, number>>("stats");
    const format = formatOption(options.format);
    if (format === "json") return printJson(stats);
    if (format !== "table") throw new Error("统计只支持 table 或 json 输出");
    for (const [key, value] of Object.entries(stats)) console.log(`${key}: ${value}`);
  });
}

export function exitCodeFor(error: unknown): number {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 3;
    if (error.statusCode === 404) return 4;
    if (error.statusCode === 0) return 5;
    return 1;
  }
  return 2;
}
