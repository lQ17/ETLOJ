# ETLOJ Remote MCP Phase 1–3 实施与联合规划

> 当前有效主文档。原始规划、候选方案和详细设计讨论见《ETLOJ 远程 MCP 服务开发建议与实施任务书（历史设计稿）》。

## 1. 当前状态

更新时间：2026-08-21

```text
Phase 1 代码开发：已完成
本地自动化测试：已完成
标准 MCP Client 本地协议验证：已完成
生产服务器部署：已完成
公网真实题库验收：已完成
Phase 2 代码开发与自动化测试：已完成
Phase 2 生产部署与公网验收：已完成
Phase 3 管理员测试数据 MCP 本地实现：已完成
Phase 3 生产部署与公网验收：待执行
```

当前实现范围为：

```text
Anonymous Public Read-Only Remote MCP
Authorized Personal Learning Progress MCP
Authorized Administrator Testcase MCP
```

匿名入口提供六个工具：

```text
search_problems
get_problem
get_problem_markdown
list_tags
list_problem_lists
get_problem_list
```

授权入口额外提供三个个人工具：

```text
get_my_problem_status
list_my_submissions
get_submission
```

当实时角色为 `ADMIN` 且令牌显式包含对应 scope 时，授权入口额外提供四个管理员测试数据工具：

```text
list_problem_testcases
get_problem_testcase
add_problem_testcase
delete_problem_testcase
```

Phase 2 已按“先公开题单安全查询，再 Authorization，最后个人只读工具”的顺序完成，并于 2026-08-10 通过生产真实数据验收。

---

## 2. 范围边界

### 已完成

- 复用 NestJS `ProblemService` 和 `TagService`。
- 使用 MCP TypeScript SDK v2.0.0。
- 提供独立 `/mcp` Streamable HTTP endpoint。
- 实现四个公开只读题库工具。
- 限制匿名用户只能访问公开题。
- 提供字段白名单、安全错误、日志和基础限流。
- 增加 MCP tools 单元测试和 HTTP 集成测试。
- 增加 Nginx `/mcp` 反向代理配置。
- 更新 README 和部署输出。
- 实现仅限实时 `ADMIN` 且显式持有 `testcases:read` / `testcases:write` 的管理员测试数据 MCP 工具；普通用户和教师不获得该能力。
- OAuth 授权页已展示管理员 scope 的中文说明，并对 `testcases:write` 给出高风险提示。

### 未实现（明确排除）

```text
用户登录 Tool
提交代码
运行代码
教师 MCP（管理员测试数据工具不授予 TEACHER）
管理员测试数据以外的管理操作
题目创建、修改、删除
普通用户或教师访问隐藏测试数据
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
version: 0.2.0
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

### 5.4 list_tags

用途：获取公开题库实际使用的完整标签列表，供 Agent 在调用 `search_problems` 前选择标签。

Description：

```text
List tags used by public ETLOJ problems, with public problem counts.
```

Input：

```ts
{
  keyword?: string; // trim 后 1～50 字符
}
```

Service：

```ts
TagService.findPublicTags(keyword)
```

结构化输出：

```ts
{
  items: Array<{
    name: string;
    problemCount: number;
  }>;
  total: number;
}
```

标签的出现条件和 `problemCount` 均显式限制为 `Problem.isPublic=true`；仅被隐藏题使用的标签不返回。

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
7. 公开入口和个人工具不得返回：

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

管理员测试数据工具是受控例外：仅在实时角色为 `ADMIN` 且调用令牌拥有对应
`testcases:read` / `testcases:write` scope 时，按工具契约返回当前请求的测试点
元数据、输入或标准输出；不得返回绝对路径、目录结构、Token、堆栈或审计正文。

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
MCP_TESTCASE_MAX_FILE_BYTES=31457280
MCP_TESTCASE_READ_CHUNK_CHARS=32768
MCP_TESTCASE_READ_MAX_CHARS=65536
MCP_TESTCASE_MAX_COUNT=1000
MCP_ADMIN_WRITE_RATE_LIMIT_MAX=10
MCP_ADMIN_WRITE_RATE_LIMIT_WINDOW_MS=60000
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
    ├── problem.tools.ts
    └── tag.tools.ts
```

职责：

```text
mcp.module.ts
  NestJS DI，依赖 ProblemModule 和 TagModule

mcp.service.ts
  创建 McpServer，保存基础 rate-limit 状态

mcp.http.ts
  挂载 /mcp、Host 校验、HTTP rate limit、安全 HTTP 错误

problem.tools.ts
  schema、工具注册、Service 调用、输出白名单、日志和安全错误

tag.tools.ts
  list_tags schema、公开 TagService 调用、输出白名单、日志和安全错误
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
npm test -- --runInBand src/mcp src/tag/tag.service.spec.ts
npm run build
```

结果：

```text
MCP + Tag Suites: 3 passed, 3 total
MCP + Tag Tests:  11 passed, 11 total
Server build:    passed
MCP ESLint:      passed
```

标准 SDK Client 已在本地真实 HTTP listener 上完成：

```text
initialize
tools/list
tools/call list_tags
tools/call search_problems
tools/call get_problem
tools/call get_problem_markdown
```

测试覆盖：

```text
只列出四个公开只读 tools
list_tags 只调用 TagService.findPublicTags
list_tags keyword=51 被 schema 拒绝
公开标签查询的出现条件和计数条件均使用 isPublic=true
search_problems 使用 isAdmin=false
get_problem 使用 isAdmin=false
隐藏题错误不泄露内部信息
pageSize=51 被 schema 拒绝
Streamable HTTP 路由和协议握手
四个工具的 HTTP 调用
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

## 10. 生产验收记录

### 初始 Phase 1（etloj 0.1.0）

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

### `list_tags` 扩展（etloj 0.2.0）

- [x] 本地执行 MCP、HTTP 和 TagService 测试，共 3 套 11 项。
- [x] 本地完成 NestJS 构建和相关 ESLint。
- [x] 仅上传本地 `dist` 构建产物，部署包不包含任何 `.env`。
- [x] 使用标准 MCP Client 连接 `https://etloj.space/mcp`。
- [x] 验证 `tools/list` 只返回四个公开只读工具。
- [x] 验证 `list_tags` 的四项只读 annotations。
- [x] 验证无参数完整列表和 `keyword` 过滤。
- [x] 验证 51 字符 keyword 被 schema 拒绝。
- [x] 验证同时返回 `content` 和 `structuredContent`。
- [x] 验证结构化标签字段仅包含 `name` 和 `problemCount`。
- [x] 使用独立 Prisma 只读聚合与 MCP 结果逐项比对。
- [x] 验证隐藏题标签关联不会影响 `problemCount`。
- [x] 验证标签的 `problemCount` 与 `search_problems` 结果总数一致。
- [x] 检查生产服务、内存、既有页面/API 和 MCP 日志。

验收记录（2026-08-10）：

```text
部署提交：06fb03f feat(mcp): add public tag listing
公网地址：https://etloj.space/mcp
服务信息：etloj 0.2.0
tools/list：get_problem、get_problem_markdown、list_tags、search_problems
公开标签数量：47
独立审计：MCP 标签名称和公开题数量与 Prisma 只读聚合逐项一致
隐藏题关联：生产库存在 1 条隐藏题标签关联，涉及 1 个公开/隐藏混合标签
侧信道验收：上述隐藏关联未计入 problemCount；当前无仅隐藏题标签
字段白名单：name、problemCount
输入验收：无参数、keyword 过滤成功；51 字符 keyword 被拒绝
联动验收：抽样标签的 problemCount 与 search_problems total 一致
双格式输出：content 和 structuredContent 均存在
运行状态：Nginx、后端、Judge、go-judge、MariaDB、Redis 均为 active
后端内存：约 65 MiB
回归检查：首页和既有 /api/tags 均返回 HTTP 200
日志检查：list_tags 记录 requestId、durationMs、success、anonymous actor
生产回滚备份：/opt/etloj/backups/list-tags-before-06fb03f
```

`list_tags` 已完成生产部署和真实题库验收。

---

## 11. Phase 2 联合任务 TODO

Phase 2 作为一个联合任务交付以下两部分：

```text
A. 公开题单 MCP（匿名、公开、只读）
B. MCP Authorization + 个人学习进度（登录、私有、只读）
```

本阶段不实现提交代码和运行代码。`submit_solution`、`run_code`、`submissions:write` 与 `code:run` 延后到后续阶段，避免在 Authorization 首次落地时同时引入判题资源消耗和真实写入副作用。

### 11.1 公开题单工具

新增工具：

```text
list_problem_lists
get_problem_list
```

建议接口：

```ts
list_problem_lists({
  keyword?: string;   // trim 后 1～100 字符
  page?: number;      // integer，默认 1，最小 1
  pageSize?: number;  // integer，默认 20，范围 1～50
})

get_problem_list({
  listId: number;     // positive safe integer
})
```

`list_problem_lists` 输出字段白名单：

```text
id
title
description
problemCount（仅统计公开题）
createdAt（如产品确有展示需要）
```

`get_problem_list` 输出题单元数据及排序后的公开题目：

```text
id
title
description
items[]:
  order
  id
  slug
  title
  difficulty
  score
  tags（需要时通过公开题查询补齐）
```

公开题单安全不变量：

1. 仅返回 `isPublic=true` 的题单；私有题单与不存在题单统一返回 `Problem list not found.`。
2. 题单详情只返回公开题目，隐藏题不得出现在 items、problemCount 或任何派生统计中。
3. 当前 `ProblemListService.findOne()` 会读取题单内全部题目，`findAllPublic()` 的 `_count.items` 也会统计全部关联项；MCP 不得直接把这两个结果原样输出。实施时必须增加经过公开性过滤的 Service 查询或等价的安全聚合，并为隐藏题关联编写测试。
4. 保留题单原始排序；过滤隐藏题后顺序连续展示，不暴露被过滤位置或数量。
5. 不输出 creatorId、私有题单信息、内部关联表 ID 或其他未列入白名单的字段。
6. 两个工具均保持 `readOnlyHint=true`、`destructiveHint=false`、`idempotentHint=true`、`openWorldHint=false`。

### 11.2 MCP Authorization

个人工具开始编码前，必须先完成正式 MCP Authorization，不得增加接收用户名和密码的登录 Tool，也不得把现有网页 JWT 当作 Tool 参数传入。

实施前先依据届时使用的 MCP SDK 与规范确认并记录：

```text
Authorization Server / Resource Server 边界
客户端发现与授权流程
access token 校验、过期与撤销
scope 到 Tool 的映射
匿名公共工具与登录工具的 endpoint / tools/list 呈现策略
HTTP 401、授权不足和 Tool 错误的协议行为
```

本阶段计划 scopes：

```text
problems:read
submissions:read
```

#### 11.2.1 Phase 2 实施采用的规范与版本依据（2026-08-10）

实现依据为当前正式的 [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) 与项目锁定的 `@modelcontextprotocol/server` / `node` / `client` `2.0.0`。SDK v2 官方文档明确将 MCP Server 定位为 Resource Server，使用 `verifyBearerToken` / `bearerAuthChallengeResponse` / RFC 9728 metadata，并将验证后的 `AuthInfo` 传入 `ctx.http.authInfo`；Authorization Server 由同源 ETLOJ OAuth 模块独立实现，不使用已冻结的 v1 Authorization Server helper。

采用协议：

```text
Authorization Server issuer: https://etloj.space
Public Resource Server:       https://etloj.space/mcp
Protected Resource Server:    https://etloj.space/mcp/private
Protected Resource Metadata:  /.well-known/oauth-protected-resource/mcp/private
Authorization Server Metadata:/.well-known/oauth-authorization-server
Grant: Authorization Code + PKCE S256
Client registration: RFC 7591 Dynamic Client Registration（公开客户端，兼容标准 MCP Client）
Resource binding: RFC 8707 resource=https://etloj.space/mcp/private
Authorization response issuer: RFC 9207 iss
Token storage: Redis 中仅以 SHA-256 token 摘要作为 key
Access token: 不透明随机令牌，1 小时过期
Refresh token: 不透明随机令牌，30 天过期，每次刷新强制轮换
Revocation: RFC 7009 风格撤销端点，撤销后 Resource Server 即时拒绝
```

endpoint / `tools/list` 策略：

1. `/mcp` 保持完全匿名，只呈现四个原有公开题库工具和两个公开题单工具；现有匿名客户端无需迁移。
2. `/mcp/private` 在 MCP handshake 前执行 Bearer 验证，未登录、无效、过期或已撤销 token 返回带 `resource_metadata` 的 HTTP 401。
3. `/mcp/private` 的已认证 `tools/list` 呈现六个公开工具和三个个人工具；Tool schema 均不含 `userId`。
4. `tools/call` 在 HTTP 边界根据 Tool 名逐项要求 `problems:read` 或 `submissions:read`，scope 不足返回带所需 scope 的 HTTP 403；Tool handler 内再次校验 scope 与认证上下文。
5. 用户身份只从 Redis token 记录和当前数据库用户状态生成的 `AuthInfo.extra.userId` 获取；网页 JWT 只用于同源授权确认页识别资源所有者，绝不作为 MCP access token 或 Tool 参数。
6. 私有/不存在题单、隐藏/不存在题目、他人/不存在提交分别使用同类统一安全错误，不在错误或日志中记录 token、授权码、刷新令牌、源代码或提交正文。

### 11.3 个人学习进度工具

Authorization 验收后再新增：

```text
get_my_problem_status
list_my_submissions
get_submission
```

范围建议：

- `get_my_problem_status`：批量查询当前用户对指定公开题目的 `AC` / `ATTEMPTED` / `UNATTEMPTED` 状态。
- `list_my_submissions`：按公开题目、状态和时间分页查询当前用户自己的提交摘要，不返回其他用户数据。
- `get_submission`：读取当前用户自己的单次提交详情；是否返回完整源代码必须由 `submissions:read` 的授权说明、产品界面提示和隐私评审共同确认，默认优先最小化输出。
- Agent 可结合公开题单、公开题库和个人状态制定学习计划；服务端不需要在本阶段实现独立推荐算法。

个人数据授权不变量：

1. 所有 userId 必须来自已验证的认证 token/context。
2. Agent 不得传入、覆盖或选择 userId，Tool schema 中不得出现 userId。
3. 个人工具必须逐个校验所需 scope，不能只判断“已登录”。
4. 普通用户只能读取自己的提交；教师和管理员也不得通过这些 `my` 工具选择其他用户。
5. 不得在访问日志、错误日志或审计日志中记录 access token、完整源代码或提交详情正文。
6. 未授权、token 失效、scope 不足和资源不存在必须有稳定且不泄露隐私的错误语义。
7. Judge 内部接口和 `x-judge-secret` 永远不得暴露为 MCP Tool。

### 11.4 实施顺序

同一任务内按以下顺序执行，不得因联合交付而跳过 Authorization 门禁：

1. 为 `ProblemListService` 增加 MCP 所需的公开题单安全查询，或建立等价的专用只读查询层。
2. 实现并测试 `list_problem_lists`、`get_problem_list`，完成匿名调用和隐藏数据隔离验收。
3. 完成 MCP Authorization 设计记录、实现和标准客户端协议测试。
4. 实现三个个人学习进度只读工具，并验证 userId/context/scope 不变量。
5. 执行 MCP 单元测试、HTTP 集成测试、既有题单/提交 API 回归测试和生产构建。
6. 部署后分别以匿名客户端和已授权客户端完成公网真实数据验收。

### 11.5 Phase 2 完成标准

- [x] 匿名客户端可调用六个公开只读工具：现有四个题库工具 + 两个公开题单工具。
- [x] 私有题单、隐藏题及其数量不会通过题单工具泄露。
- [x] 标准 MCP Client 能完成正式授权，token 不通过 Tool 参数传递。
- [x] 未授权客户端不能调用任何个人学习进度工具。
- [x] 已授权客户端只能读取 token 对应用户的数据，且 scope 校验生效。
- [x] 三个个人工具均有 schema、字段白名单、安全错误、日志和测试。
- [x] 匿名与登录两条调用路径均完成 HTTP 集成测试和生产真实数据验收。
- [x] 首页 MCP 教程在 Authorization 上线后同步补充登录接入说明。
- [x] `submit_solution` 和 `run_code` 未混入本阶段交付。

### 11.6 Phase 2 完成记录（2026-08-10）

实现与自动化验证：

- `ProblemListService` 使用 MCP 专用查询，数据库条件同时限制公开题单与公开题目；过滤后重新连续编号，不返回关联表 ID、creatorId 或隐藏题派生数量。
- `/mcp` 回归六个匿名工具；`/mcp/private` 经 Bearer 校验后呈现九个工具。HTTP 集成测试覆盖 initialize、tools/list、tools/call、缺失/无效/过期 token、scope 不足与认证上下文身份不可被参数覆盖。
- OAuth 单元测试覆盖 DCR、Authorization Code + PKCE S256、resource 绑定、一次性授权码、refresh token 轮换、scope 缩减与撤销。
- 提交查询把 `userId` 固定在数据库 where 条件中，教师/管理员角色没有越权分支；提交详情仅返回 `codeSize`，不返回源码正文。
- Server Jest 全量 6 suites / 26 tests 通过，Server build 通过，新增 MCP/Auth/测试文件的 ESLint 通过；CLI 3 tests 与 build 通过，Judge `tsc --noEmit` 通过，Client production build 通过。本次涉及的 Client 文件单独 ESLint 通过。仓库全量 Server ESLint 仍有既有的 1442 errors / 29 warnings，全量 Client ESLint 仍有既有的 388 errors / 26 warnings；未自动修复或改写这些任务范围外文件，也未把全量 lint 描述为通过。

生产部署与验收：

- 回滚备份：`/opt/etloj/backups/mcp-phase2-before-20260810-171759`。服务器未执行 npm install/build，未修改 `.env`、Prisma schema、密钥、题目数据、Judge 或 go-judge；前端部署前已清理旧 hash 文件。
- Nginx 已保留并版本化生产 TLS 配置，加入 `/mcp` 与 OAuth discovery 代理；`nginx -t` 通过，HTTP 301 跳转、HTTPS 证书校验和 HSTS 正常。
- 公网匿名标准 MCP Client 实测服务版本 `0.3.0`，发现六个工具；真实数据为 47 个公开标签、2040 道公开题、9 个公开题单，题目详情/Markdown、题单详情及输入上界拒绝均通过。
- 公网授权标准 MCP Client 完成真实 DCR、PKCE 授权码、token、tools/list 与 tools/call 流程；发现九个工具，个人状态、当前账号 139 条提交摘要、最小化详情、伪造 userId 无效、scope 不足 403、撤销后 401 均通过。验收产生的 access/refresh token 已撤销且未输出。
- Nginx、后端、Judge、go-judge、MariaDB、Redis 均为 active；go-judge 保持 v1.9.0；可用内存 1120 MB。既有首页与题单 API 返回 200，匿名个人提交 API 返回 401。部署后后端 error journal 为空，MCP 日志未匹配 Bearer/access token 泄漏模式。

---

### 11.7 Phase 3 管理员测试数据 MCP（2026-08-21）

Phase 3 已纳入当前实现范围，但生产部署和公网真实题库验收仍需单独执行。管理员工具继续复用
`/mcp/private`，不新增 `/mcp/admin`；实时角色和 OAuth scope 必须同时满足：

```text
testcases:read   list_problem_testcases、get_problem_testcase
testcases:write  add_problem_testcase、delete_problem_testcase
```

已实现的安全边界：

- `ADMIN` 角色在 Token 验证时实时读取；降权、停用或取消审核后，旧 Token 不能继续调用管理员工具；
- `USER`、`TEACHER` 和匿名客户端不会在 `tools/list` 中看到管理员工具；管理员也不能仅凭角色绕过缺失 scope；
- 读取工具只返回测试点元数据或按分块请求的输入/标准输出，写工具只允许追加和确认删除，不接受客户端文件路径；
- `testcases:write` 具有明显的授权页风险提示，写操作使用大小、数量、幂等、revision 和账号级限流保护；
- 安全错误保持稳定且不泄露路径、测试数据正文、凭证或堆栈；OAuth 授权页能够显示后端返回的 `error_description` / `invalid_scope`。

本地交付清单：

- [x] 增加 `testcases:read`、`testcases:write` 的中文授权说明；
- [x] 更新管理员测试数据 MCP 的 README、环境变量示例和 Compose 可选配置；
- [x] 从“明确排除”中移除管理员测试数据 MCP，保留教师及其他管理员操作的排除；
- [x] 使用专门测试题完成 list、read、append、delete、幂等重试和 revision 冲突验收；
- [x] 完成生产备份、部署、回滚和公网验收记录。

生产部署与验收（2026-08-21）：

- 发布目录：`/opt/etloj/releases/phase3-f66ff56-local-20260821-163437`；Server 与 Client 发布包在本地和远端的 SHA-256 一致，包内不含 `.env`、Windows Prisma 引擎或临时文件。
- 回滚备份：`/opt/etloj/backups/phase3-before-20260821-163437`，包含 MariaDB dump、1.5 GB 题目目录快照、旧 Server/Prisma 制品、完整旧 Server 目录、旧前端、systemd unit、Nginx 配置及 `SHA256SUMS`。
- Prisma diff 经审查只创建 `mcp_admin_audit_logs`、索引及两个 `ON DELETE SET NULL` 外键；生产执行 `prisma db push --skip-generate` 成功，未使用 `--accept-data-loss`。
- Server 和前端均通过旁路暂存与目录重命名原子发布；保留既有 Server/Judge unit、内存限制、环境文件和 Judge/go-judge，不在生产安装依赖或构建。
- 使用一次性隐藏题和短期测试 Token，通过官方 MCP Client 真实 HTTPS 验收匿名/非管理员/管理员 6/9/13 工具可见性、scope challenge、分块读取、append/delete、幂等重放和 revision 冲突；临时题与 Token 已清理。
- 两轮验收共留下 12 条脱敏审计，10 条成功、2 条为预期 `REVISION_CONFLICT`，无 PENDING；检查确认不含测试正文、Token、绝对路径或遗留事务目录。
- 每轮均完成两次正式 C++ 提交和一次运行代码：正式提交均 AC、运行代码为 OK，提交测试点快照数量分别为 1 和 2，验证修改前后任务使用各自入队快照。临时提交已清理。
- 验收结束后站点统计恢复为 2044 题、771 次提交、11 位用户；六项服务 active，四个 Redis 判题队列为 0，Server/Judge error journal 为空，磁盘剩余约 24 GB。

MCP 动态配额部署与验收（2026-08-23）：

- 部署提交：`263a055 feat(mcp): add runtime rate limit settings`；发布目录：`/opt/etloj/releases/mcp-rate-limits-263a055-20260823-162918`，回滚备份：`/opt/etloj/backups/mcp-rate-limits-before-20260823-162918`。
- Server 与 Client 均在本地完成构建，只上传 `dist` 制品；远端 SHA-256 校验一致，制品不含 `.env`、依赖、题目数据或密钥。无依赖、Prisma schema、Judge、go-judge、Nginx 或 systemd unit 变更，生产端未执行安装、构建、Prisma 生成或 `db push`。
- Server 先以生产数据在旁路端口 3100 启动验证，再与完整前端目录原子切换；旧 Server 和前端分别保留为 `/opt/etloj/server.pre-263a055`、`/var/www/etloj.pre-263a055`。
- 配额管理 API 真实角色验收通过：未登录 401、非管理员 403、管理员 200、越界 PATCH 400 且配置不变；合法配置写入 Redis 后重启 Server，四项配置均成功恢复。
- 公网首页、统计和匿名 MCP 6 个公开工具通过；两次正式提交均为 AC、运行代码为 OK，临时提交已清理。验收结束后统计恢复为 2044 题、776 次提交、11 位用户，六项服务 active，四个判题队列为 0，两个阻塞消费者正常，Server/Judge error journal 为空，磁盘剩余约 23 GB。

测试数据单文件 30 MB 限制部署与验收（2026-08-24）：

- 部署提交：`8091ed5 fix(testcases): raise per-file limit to 30MB`；发布目录：`/opt/etloj/releases/testcase-limit-8091ed5-20260824-164255`，配置备份：`/opt/etloj/backups/testcase-limit-before-8091ed5-20260824-164255`。
- Server 与 Client 均在本地完成构建，Server 全量 77 项测试通过；上传制品的 SHA-256 前后一致，包内不含 `.env`、依赖、题目数据或密钥。无依赖、Prisma schema、Judge、go-judge、Nginx 或 systemd unit 变更，生产端未执行安装、构建、Prisma 生成或 `db push`。
- Server 先使用生产数据在旁路端口 3100 验证，再与前端完成目录重命名切换；旧 Server 和前端保留为 `/opt/etloj/server.pre-8091ed5`、`/var/www/etloj.pre-8091ed5`，生产 `.env` 仅将 `MCP_TESTCASE_MAX_FILE_BYTES` 定点更新为 `31457280`。
- 生产接口以不会落盘的 30 MB + 1 字节请求验证返回 413 和中文超限信息；运行代码返回 `OK` 和预期输出。HTTPS 首页、哈希静态资源、未授权 WebSocket 1008、go-judge v1.9.0、仅本机 5050 监听和公网端口隔离均通过。
- 验收结束时统计为 2044 题、801 次提交、11 位用户；六项服务 active，四个判题队列均为 0，两个独立阻塞消费者正常，Server error journal 为空。

## 12. Agent 接手规则

后续 Agent 开始工作前应：

1. 先检查当前 git diff，保留用户已有修改。
2. 阅读实际 `ProblemService`、`ProblemListService`、提交/认证模块和 MCP 实现，不以历史设计稿中的候选代码覆盖当前接口。
3. 修改 Tool 时同步更新 schema、白名单、单元测试和 HTTP 集成测试。
4. 任何个人数据或副作用能力必须等待 OAuth/Authorization 完成。
5. Phase 2 必须保留匿名公开工具的既有行为，并分别测试匿名、已登录但 scope 不足、已获正确 scope 三种客户端状态。
6. 完成修改后至少执行：

```bash
cd server
npm test -- --runInBand src/mcp src/problem-list
npm run build
```

7. 涉及 Nginx 或 Authorization 路由/元数据时必须在部署机执行：

```bash
nginx -t
```

8. 不得把未执行的生产操作描述为已完成。
