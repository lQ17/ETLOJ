# ETLOJ Remote MCP Phase 1 实施任务书

> 当前有效主文档。原始规划、候选方案和详细设计讨论见《ETLOJ 远程 MCP 服务开发建议与实施任务书（历史设计稿）》。

## 1. 当前状态

更新时间：2026-08-10

```text
Phase 1 代码开发：已完成
本地自动化测试：已完成
标准 MCP Client 本地协议验证：已完成
生产服务器部署：已完成
公网真实题库验收：已完成
Phase 2 OAuth 与用户能力：未开始
```

当前实现范围仅为：

```text
Public Read-Only Remote MCP
```

提供三个工具：

```text
search_problems
get_problem
get_problem_markdown
```

不得将生产部署、公网连接或真实生产题库描述为已经验收。

---

## 2. 范围边界

### 已完成

- 复用 NestJS `ProblemService`。
- 使用 MCP TypeScript SDK v2.0.0。
- 提供独立 `/mcp` Streamable HTTP endpoint。
- 实现三个公开只读题目工具。
- 限制匿名用户只能访问公开题。
- 提供字段白名单、安全错误、日志和基础限流。
- 增加 MCP tools 单元测试和 HTTP 集成测试。
- 增加 Nginx `/mcp` 反向代理配置。
- 更新 README 和部署输出。

### 未实现

```text
OAuth / MCP Authorization
用户登录 Tool
读取个人提交
提交代码
运行代码
管理员或教师 MCP
题目创建、修改、删除
隐藏测试数据读取
标准答案读取
Judge callback
Resources
Prompts
Agent Skill
```

禁止暴露：

```text
judge_callback
update_submission_result
clean_dirty_submissions
delete_problem
save_testcases
get_hidden_testcases
run_sql
execute_shell
execute_command
arbitrary_http_request
```

---

## 3. 已验证的项目事实

### Runtime 与框架

```text
生产最低 Node.js：20
本地验证 Node.js：24.14.0
NestJS：11.x
Express types：5.x
TypeScript：5.7.x
MCP TypeScript SDK：2.0.0
Zod：4.x
```

MCP SDK 使用拆分包：

```text
@modelcontextprotocol/server
@modelcontextprotocol/node
@modelcontextprotocol/client（devDependency，仅测试）
zod
```

### NestJS 入口

`server/src/main.ts` 已设置：

```ts
app.setGlobalPrefix("api");
```

因此：

```text
现有 REST API：/api/*
Remote MCP：/mcp
WebSocket：/ws/*
```

`/mcp` 直接挂载到底层 Express adapter，不受 `/api` 全局前缀影响。

### ProblemService

必须复用以下现有接口：

```ts
ProblemService.findAll(query, isAdmin)
ProblemService.findOne(idOrSlug, isAdmin)
ProblemService.getMarkdown(idOrSlug)
```

匿名 MCP 的安全调用方式固定为：

```ts
ProblemService.findAll(query, false)
ProblemService.findOne(idOrSlug, false)
ProblemService.getMarkdown(idOrSlug)
```

`getMarkdown()` 内部通过 `resolveProblem(idOrSlug, false)` 检查公开状态。

`ProblemModule` 已导出：

```text
ProblemService
ProblemImportExportService
```

MCP 不调用 CLI，也不通过 `/api/problems` 做本机 HTTP 转发。

---

## 4. 当前架构

```text
MCP Client / Agent
        ↓
https://etloj.space/mcp
        ↓
Nginx /mcp
        ↓
http://127.0.0.1:3000/mcp
        ↓
NestJS 底层 Express adapter
        ↓
createMcpHandler + toNodeHandler
        ↓
McpService.createServer()
        ↓
problem.tools.ts
        ↓
ProblemService
        ↓
Prisma / 题目 Markdown 文件
```

SDK v2 的 `createMcpHandler` 为每个 HTTP 请求创建新的 `McpServer`，当前服务不保存 MCP session map。

服务 metadata：

```text
name: etloj
version: 0.1.0
```

同一 endpoint 支持 SDK v2 的现代协议探测，并保留 2025-era stateless `initialize` 兼容路径。

---

## 5. MCP Tools

所有工具均设置：

```text
readOnlyHint: true
destructiveHint: false
idempotentHint: true
openWorldHint: false
```

所有成功结果同时提供：

```text
content
structuredContent
```

### 5.1 search_problems

用途：搜索 ETLOJ 公开算法题。

Description：

```text
Search public ETLOJ programming problems by keyword, difficulty and tags.
```

Input：

```ts
{
  keyword?: string;       // trim 后 1～100 字符
  difficulty?:            // ETLOJ Difficulty 枚举
    | "IRON"
    | "BRONZE"
    | "SILVER"
    | "GOLD"
    | "PLATINUM"
    | "DIAMOND"
    | "MASTER"
    | "CHAMPION"
    | "LEGENDARY";
  tags?: string[];        // 最多 10 个，每个 1～50 字符
  tagMode?: "AND" | "OR"; // 默认 OR
  page?: number;          // integer，默认 1，最小 1
  pageSize?: number;      // integer，默认 20，范围 1～50
}
```

Service：

```ts
ProblemService.findAll(query, false)
```

结构化输出：

```ts
{
  items: Array<{
    id: number;
    slug: string;
    title: string;
    difficulty: string;
    tags: string[];
    score: number;
    limits: {
      timeMs: number;
      memoryMb: number;
    };
    stats: object;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

### 5.2 get_problem

用途：按数字 ID 或 slug 获取公开题详情。

Description：

```text
Get the public statement and metadata for an ETLOJ problem by numeric id or slug.
```

Input：

```ts
{
  problem: string; // trim 后 1～200 字符，不允许路径分隔符或 ".."
}
```

纯数字字符串解析为数据库数字 ID，其他值作为 slug 交给现有 `ProblemService`。

Service：

```ts
ProblemService.findOne(idOrSlug, false)
```

结构化输出：

```ts
{
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  statement: string;
  limits: {
    timeMs: number;
    memoryMb: number;
  };
  score: number;
  testcaseCount: number;
  stats: object;
}
```

不返回测试点内容。

### 5.3 get_problem_markdown

用途：按数字 ID 或 slug 获取公开题原始 Markdown。

Description：

```text
Get the original Markdown for a public ETLOJ problem by numeric id or slug.
```

Input 与 `get_problem` 相同。

Service：

```ts
ProblemService.getMarkdown(idOrSlug)
```

输出：

```ts
{
  problem: string;
  markdown: string;
}
```

Markdown 不经过 HTML 中转。

---

## 6. 安全不变量

后续修改不得破坏以下规则：

1. 匿名搜索必须显式传入 `isAdmin=false`。
2. 匿名详情必须显式传入 `isAdmin=false`。
3. Markdown 必须走内部公开状态检查。
4. 隐藏题和不存在题统一返回：

```text
Problem not found.
```

5. 不得通过错误文本泄露隐藏题是否存在。
6. 输出必须使用字段白名单。
7. 不得返回：

```text
filePath
隐藏测试数据
标准答案
管理员字段
Judge secret
数据库内部错误
stack trace
用户提交记录
```

8. 非预期错误对客户端统一返回：

```text
Internal ETLOJ error.
```

9. 服务端保留详细异常日志。
10. 日志记录：

```text
tool name
MCP request id
durationMs
success / failure
anonymous actor
```

11. 日志不得记录 token、密码、完整用户代码或测试数据。
12. HTTP 入口使用官方 Host header validation。
13. 默认允许的 Host：

```text
etloj.space
localhost
127.0.0.1
[::1]
```

14. 默认按客户端 IP 每 60 秒最多接受 60 个 MCP HTTP 请求。

可选配置：

```env
MCP_ALLOWED_HOSTS=etloj.space,localhost,127.0.0.1,[::1]
MCP_RATE_LIMIT_MAX=60
MCP_RATE_LIMIT_WINDOW_MS=60000
```

---

## 7. 当前文件结构

```text
server/src/mcp/
├── mcp.module.ts
├── mcp.service.ts
├── mcp.http.ts
├── mcp.service.spec.ts
├── mcp.http.spec.ts
└── tools/
    └── problem.tools.ts
```

职责：

```text
mcp.module.ts
  NestJS DI，依赖 ProblemModule

mcp.service.ts
  创建 McpServer，保存基础 rate-limit 状态

mcp.http.ts
  挂载 /mcp、Host 校验、HTTP rate limit、安全 HTTP 错误

problem.tools.ts
  schema、工具注册、Service 调用、输出白名单、日志和安全错误
```

本次相关修改文件：

```text
README.md
deploy.sh
nginx/default.conf
server/package.json
server/package-lock.json
server/src/app.module.ts
server/src/main.ts
server/src/mcp/*
```

---

## 8. 测试状态

### 已执行

```bash
cd server
npm test -- --runInBand src/mcp
npm run build
```

结果：

```text
MCP Test Suites: 2 passed, 2 total
MCP Tests:       7 passed, 7 total
Server build:    passed
MCP ESLint:      passed
```

标准 SDK Client 已在本地真实 HTTP listener 上完成：

```text
initialize
tools/list
tools/call search_problems
tools/call get_problem
tools/call get_problem_markdown
```

测试覆盖：

```text
只列出三个 Phase 1 tools
search_problems 使用 isAdmin=false
get_problem 使用 isAdmin=false
隐藏题错误不泄露内部信息
pageSize=51 被 schema 拒绝
Streamable HTTP 路由和协议握手
三个工具的 HTTP 调用
```

注意：HTTP 集成测试使用真实 MCP HTTP transport 和官方 SDK Client，但 `ProblemService` 使用测试替身，不等同于生产数据库验收。

### 既有组件回归结果

```text
Client production build：passed
CLI tests：3 passed
CLI build：passed
Judge TypeScript --noEmit：passed
git diff --check：passed
```

---

## 9. Nginx 与部署

当前 Nginx 配置：

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

目标 URL：

```text
内部：http://127.0.0.1:3000/mcp
公网：https://etloj.space/mcp
```

生产部署：

```bash
cd /opt/etloj/server
npm ci
npm run build
sudo systemctl restart etloj-server

sudo cp /opt/etloj/nginx/default.conf /etc/nginx/sites-available/etloj
sudo nginx -t
sudo systemctl reload nginx
```

当前 Windows 开发环境未安装 Nginx；`nginx -t` 已在生产服务器执行并通过。

---

## 10. 生产验收清单

- [x] 在生产服务器执行 `nginx -t`。
- [x] 重启 `etloj-server`。
- [x] reload Nginx。
- [x] 使用标准 MCP Client 或 Inspector 连接 `https://etloj.space/mcp`。
- [x] 验证 `initialize` / `server/discover`。
- [x] 验证 `tools/list` 只返回三个 Phase 1 工具。
- [x] 使用真实公开题调用 `search_problems`。
- [x] 使用真实数字 ID 和 slug 调用 `get_problem`。
- [x] 使用真实公开题调用 `get_problem_markdown`。
- [x] 使用真实隐藏题确认返回 Not Found。
- [x] 确认响应不包含文件路径、测试数据或 stack trace。
- [x] 连续调用并观察限流、内存和数据库状态。
- [x] 检查生产日志不包含敏感信息。

验收记录（2026-08-10）：

```text
部署提交：4bd43ef feat(mcp): add public read-only remote service
公网地址：https://etloj.space/mcp
服务信息：etloj 0.1.0
tools/list：仅 search_problems、get_problem、get_problem_markdown
真实公开题库：search_problems 返回 2040 道公开题
真实题目验收：数字 ID、slug、原始 Markdown 均调用成功
隐藏题验收：详情和 Markdown 均统一返回 Problem not found.，未泄露标识
响应白名单：未发现 filePath、测试数据、标准答案或 stack trace
限流：同一 IP 的窗口内第 60 次连续请求返回 HTTP 429
运行状态：Nginx、后端、Judge、go-judge、MariaDB、Redis 均为 active
后端内存：约 76 MiB
回归检查：首页和既有公告 API 均返回 HTTP 200
日志检查：包含 tool、requestId、durationMs、success/failure、anonymous actor，未发现敏感信息
生产回滚备份：/opt/etloj/backups/mcp-phase1-before-4bd43ef
```

Phase 1 已完成生产部署和公网真实题库验收。

---

## 11. Phase 2 TODO

Phase 2 必须先实现正式 MCP Authorization，不得增加接收用户名和密码的登录 Tool。

计划 scopes：

```text
problems:read
submissions:read
submissions:write
code:run
```

候选工具：

```text
get_my_problem_status
list_my_submissions
get_submission
submit_solution
run_code
```

授权不变量：

1. 所有 userId 必须来自认证 token/context。
2. Agent 不得传入或选择 userId。
3. `submit_solution` 和 `run_code` 必须明确标记真实副作用。
4. 不得记录完整源代码。
5. Judge 内部接口和 `x-judge-secret` 永远不得暴露为 MCP Tool。

---

## 12. Agent 接手规则

后续 Agent 开始工作前应：

1. 先检查当前 git diff，保留用户已有修改。
2. 阅读实际 `ProblemService` 和 MCP 实现，不以历史设计稿中的候选代码覆盖当前接口。
3. 修改 Tool 时同步更新 schema、白名单、单元测试和 HTTP 集成测试。
4. 任何个人数据或副作用能力必须等待 OAuth/Authorization 完成。
5. 完成修改后至少执行：

```bash
cd server
npm test -- --runInBand src/mcp
npm run build
```

6. 涉及 Nginx 时必须在部署机执行：

```bash
nginx -t
```

7. 不得把未执行的生产操作描述为已完成。
