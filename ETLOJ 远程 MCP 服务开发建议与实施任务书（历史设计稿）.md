# ETLOJ 远程 MCP 服务开发建议与实施任务书（历史设计稿）

> **当前状态（2026-08-10）**：Phase 1 代码开发、本地自动化测试和标准 MCP Client 协议验证已完成；生产服务器部署、`nginx -t`、公网 URL 和真实生产题库验收尚待执行。详见第 37 节。

## 1. 项目背景

本任务目标是在现有 ETLOJ OJ 平台中增加一个 **Remote MCP Server**，使支持 MCP 的 AI Agent 可以直接访问 ETLOJ 的题库能力，并为未来“查询个人提交、分析错题、提交代码”等 Agent 工作流做好架构基础。

本次开发应优先：

**复用 ETLOJ 已有 NestJS Service，不重新实现 OJ 业务逻辑，不通过 CLI 间接调用。**

最终目标架构：

```text
                       ETLOJ
                         │
                ┌────────┴────────┐
                │                 │
              /api/*             /mcp
                │                 │
                └────────┬────────┘
                         ↓
                    NestJS Server
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
   ProblemService  SubmissionService   Auth
          │              │
          └───────┬──────┘
                  ↓
          Prisma / Redis / Judge
```

MCP 不应设计成：

```text
Agent
 ↓
MCP
 ↓
CLI
 ↓
HTTP API
```

而应该：

```text
Agent
 ↓
MCP
 ↓
ETLOJ Service
```

现有 CLI 保持不变：

```text
CLI
 ↓
HTTP API
```

---

# 2. 开发前必须执行的检查

开始修改代码之前，请先完整检查当前仓库，不要完全依赖本任务书中的接口名称。

至少检查：

```text
server/src/main.ts

server/src/app.module.ts

server/src/problem/
server/src/submission/
server/src/auth/

server/package.json

nginx/default.conf
```

重点确认：

1. 当前 Node.js 版本要求；
2. 当前 NestJS 和 Express 版本；
3. `ProblemService` 实际公开的方法和参数；
4. `SubmissionService` 实际公开的方法和参数；
5. `ProblemModule` / `SubmissionModule` exports；
6. 当前 JWT 用户对象结构；
7. 当前生产环境 Nginx 配置；
8. 当前 MCP TypeScript SDK 最新稳定版 API。

**不得为了套用本任务书而强行修改已有 Service API。**

如果文档中的示例代码与当前 MCP SDK 不一致，以官方当前稳定版文档和官方 TypeScript SDK examples 为准。

截至任务规划时，官方 TypeScript SDK v2 使用拆分后的 `@modelcontextprotocol/server` 等包，并支持 Streamable HTTP Remote MCP。实现前请再次核对 SDK 当前稳定 API。

---

# 3. 当前 ETLOJ 已具备的基础

当前 NestJS 启动入口使用：

```text
app.setGlobalPrefix("api")
```

并默认监听：

```text
PORT ?? 3000
```

因此现有 REST API 主要位于：

```text
/api/*
```

MCP 建议独立暴露：

```text
/mcp
```

而不是：

```text
/api/mcp
```

当前 `main.ts` 还已经配置 Express JSON/body parser，因此在接 MCP HTTP handler 时要注意与已有 body parser 的兼容。

---

# 4. Service 复用原则

## Problem

当前 `ProblemModule` 已导出：

```text
ProblemService
ProblemImportExportService
```

因此 MCP Module 可以直接依赖 `ProblemModule` 并通过 Nest DI 注入 `ProblemService`，无需通过 `/api/problems` 再请求一次本机 HTTP API。

当前题目列表 Controller 调用模式为：

```text
ProblemService.findAll(query, isAdmin)
```

普通 MCP 用户第一阶段必须按照：

```text
isAdmin = false
```

处理，只能读取公开题目。

题目 Markdown 能力已经存在，并调用：

```text
ProblemService.getMarkdown(...)
```

因此可以直接复用。

---

## Submission

当前 `SubmissionModule` 已导出：

```text
SubmissionService
SubmissionGateway
```

因此以后 MCP 可以直接复用 `SubmissionService`。

现有后端已经支持：

```text
创建提交
运行代码
查询自己的提交
查询题目完成状态
查询单次提交
```

其中创建提交、运行代码以及用户提交查询都受 JWT 保护。

因此：

**第一阶段不要做这些能力。**

等 MCP OAuth 完成以后再开放。

---

# 5. 第一阶段开发范围

第一阶段只开发：

> Public Read-Only MCP

不做：

```text
OAuth
用户登录
读取个人提交
提交代码
运行代码
管理员能力
教师能力
测试点读取
题目修改
题目删除
Judge callback
```

第一阶段建议只暴露以下 3 个 Tool：

```text
search_problems

get_problem

get_problem_markdown
```

目标是先验证：

```text
AI Agent
   ↓
Remote MCP
   ↓
ETLOJ
```

这条链能够稳定运行。

---

# 6. MCP Tool 设计

## Tool 1：search_problems

建议名称：

```text
search_problems
```

用途：

```text
搜索 ETLOJ 中公开的算法题。
```

建议输入参数：

```ts
{
    keyword?: string
    difficulty?: string
    tags?: string[]
    tagMode?: "AND" | "OR"
    page?: number
    pageSize?: number
}
```

限制：

```text
page >= 1

1 <= pageSize <= 50

tags 数量建议限制 <= 10
```

实现原则：

```text
MCP Tool
    ↓
ProblemService.findAll(...)
```

务必确保：

```text
isAdmin = false
```

Agent 不得通过参数绕过公开题限制。

Tool description 应清楚告诉模型：

```text
Search public ETLOJ programming problems by keyword,
difficulty and tags.
```

---

# 7. Tool 2：get_problem

建议：

```text
get_problem
```

输入：

```ts
{
    problem: string
}
```

这里 `problem` 应同时支持：

```text
numeric id

或

slug
```

例如：

```text
"1001"

"prefix-sum-basic"
```

复用当前 ETLOJ 已有的 ID / slug 解析方式。

不要为 MCP 单独重新实现第二套题目查找规则。

输出应适合 LLM 阅读，至少应包含：

```text
id
slug
title
difficulty
tags
description / statement
input
output
samples
limits
```

实际字段应以当前 `ProblemService` 返回结构为准。

**不要为了 MCP 修改数据库结构。**

---

# 8. Tool 3：get_problem_markdown

建议：

```text
get_problem_markdown
```

用途：

```text
返回题目原始 Markdown。
```

输入：

```ts
{
    problem: string
}
```

调用：

```text
ProblemService.getMarkdown(...)
```

输出尽量保持 Markdown 原文。

不要：

```text
Markdown → HTML → Markdown
```

避免不必要的信息损失。

---

# 9. MCP 返回格式建议

不要把所有对象无脑：

```ts
JSON.stringify(...)
```

然后结束。

第一版可以这么做以快速验证，但正式实现建议同时提供：

```text
structuredContent
```

和适合模型阅读的：

```text
content
```

例如概念上：

```ts
return {
    structuredContent: result,

    content: [
        {
            type: "text",
            text: readableText,
        },
    ],
};
```

具体格式按照当前 MCP SDK稳定 API实现。

目的：

```text
模型容易阅读

+

客户端容易结构化处理
```

---

# 10. 建议目录结构

第一阶段：

```text
server/src/mcp/
├── mcp.module.ts
├── mcp.service.ts
└── tools/
    └── problem.tools.ts
```

或者：

```text
server/src/mcp/
├── mcp.module.ts
├── mcp.factory.ts
└── tools/
    └── problem.tools.ts
```

两种都可以。

建议职责：

```text
McpModule

负责 NestJS DI
```

```text
McpFactory / McpService

负责创建 McpServer
```

```text
problem.tools.ts

负责注册题目相关 MCP tools
```

不要把全部 Tool 都写进：

```text
main.ts
```

`main.ts` 只负责：

```text
启动 Nest

+

把 HTTP /mcp endpoint 接到 MCP handler
```

---

# 11. NestJS Module

新增：

```text
McpModule
```

依赖：

```text
ProblemModule
```

第一阶段没有必要依赖：

```text
SubmissionModule
```

除非实现过程中确实需要。

最终：

```text
AppModule
  ↓
McpModule
  ↓
ProblemModule
  ↓
ProblemService
```

---

# 12. MCP Server 创建方式

使用官方当前稳定版 TypeScript MCP SDK。

MCP Server metadata 建议：

```text
name: etloj

version: 与 package / 服务版本保持合理一致
```

示意：

```ts
new McpServer({
    name: "etloj",
    version: "0.1.0",
});
```

Tool 使用标准 schema 描述输入。

优先使用：

```text
Zod v4
```

或当前 MCP SDK 官方推荐的 Standard Schema 实现。

官方 SDK v2 已支持 Standard Schema，并明确支持 Zod v4。

---

# 13. Remote MCP Transport

本项目需要：

```text
Remote MCP
```

因此使用：

```text
Streamable HTTP
```

不要使用：

```text
stdio
```

作为生产 MCP。

stdio 可以用于本地调试，但不是最终部署方案。

官方 TypeScript SDK 将 Streamable HTTP 用于 Remote Server，并提供 Node/Express adapter。

第一阶段只有简单 Tool Call，没有复杂服务器主动推送能力，因此优先考虑：

```text
stateless Streamable HTTP
```

如果当前官方 SDK 建议其他更合适模式，则以 SDK 最新 examples 为准。

不要自行实现 MCP JSON-RPC 协议。

---

# 14. HTTP Endpoint

生产目标：

```text
https://etloj.space/mcp
```

内部：

```text
http://127.0.0.1:3000/mcp
```

MCP endpoint 应：

```text
POST /mcp
```

并按照 Streamable HTTP 协议正确处理需要的其他 HTTP method。

不要仅仅写成普通 Nest：

```ts
@Post("/mcp")
```

然后自己解析 JSON-RPC。

应该使用官方 MCP SDK 的 HTTP transport / middleware。

---

# 15. 关于 app.setGlobalPrefix("api")

当前：

```ts
app.setGlobalPrefix("api");
```

因此普通 Controller 默认走：

```text
/api/*
```

但目标 MCP 是：

```text
/mcp
```

不是：

```text
/api/mcp
```

实现时请根据 Nest 当前版本以及 MCP SDK当前 middleware 找最干净的接入方式。

可以：

```text
直接挂到底层 Express adapter
```

或者采用官方支持的 Express middleware 方式。

不要破坏：

```text
/api/*
/ws/*
```

现有行为。

---

# 16. Nginx

当前 ETLOJ 已经将：

```text
/api/
```

代理到：

```text
127.0.0.1:3000
```

并且 AI SSE endpoint 已经采用：

```text
proxy_buffering off
```

等流式配置。

新增独立 MCP location：

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

具体 `proxy_pass` 是否写：

```text
http://127.0.0.1:3000
```

还是：

```text
http://127.0.0.1:3000/mcp
```

必须根据最终 URI rewrite 行为测试确定。

不要盲目复制配置。

要求最终公网：

```text
https://etloj.space/mcp
```

能够被标准 MCP Client 连接。

---

# 17. 第一阶段安全要求

MCP 第一阶段仅公开：

```text
公开题目搜索
公开题目详情
公开题目 Markdown
```

不得通过 MCP 返回：

```text
隐藏题

私有题

测试数据

标准答案

管理员字段

Judge secret

数据库内部字段

用户提交记录
```

对于 `ProblemService.findAll()`：

必须明确：

```text
isAdmin = false
```

对于 `findOne()`：

必须确认 Service 内部本身会正确限制未公开题。

如果 Service 本身依赖 Controller guard 才能限制隐藏内容：

**必须在 MCP 层补上相同的授权规则。**

不要默认：

```text
“调用 Service 就一定安全”
```

一定要检查实际 Service 实现。

---

# 18. 必须防止 Tool 参数滥用

输入 schema 必须限制：

```text
字符串长度

数组长度

pageSize

problem id

slug 长度
```

例如：

```text
keyword <= 100

tags <= 10

pageSize <= 50

slug <= 200
```

避免 Agent：

```text
一次拉取整个题库

构造超长参数

恶意消耗数据库
```

---

# 19. 错误处理

不要直接把 NestJS：

```text
stack trace

SQL error

内部路径

Prisma error
```

返回给 Agent。

统一转成 MCP 能理解的安全错误。

例如：

```text
Problem not found.

Invalid problem identifier.

Requested problem is not publicly available.

Invalid search parameters.

Internal ETLOJ error.
```

服务器日志内部保留详细异常。

---

# 20. 日志

MCP 至少记录：

```text
tool name

request id

执行时间

成功 / 失败

匿名 / userId（未来有 OAuth 后）
```

不要记录：

```text
access token

password

完整用户代码
```

未来对于：

```text
submit_solution
```

可记录：

```text
submission id

problem id

language
```

但不要默认把完整 source code 打日志。

---

# 21. Rate Limit

第一阶段即使是公开 Tool，也应考虑限流。

至少：

```text
按 IP

或

按照 MCP client / request
```

避免：

```text
Agent 无限搜索题库
```

如果 ETLOJ 当前已有全局 Rate Limit，优先复用。

否则第一版可记录 TODO，但上线公网前应完成。

---

# 22. MCP Inspector / Client 测试

开发完成以后必须使用标准 MCP Client 验证。

至少测试：

```text
initialize

tools/list

tools/call search_problems

tools/call get_problem

tools/call get_problem_markdown
```

不要只：

```text
curl /mcp
```

然后认为 MCP 已成功。

必须真实完成 MCP handshake。

---

# 23. 第一阶段验收用例

## Case 1

用户：

```text
搜索包含“前缀和”的题目
```

Agent 应能够调用：

```text
search_problems
```

并获得 ETLOJ 真实题目列表。

---

## Case 2

用户：

```text
查看某一道题
```

Agent：

```text
get_problem
```

能够读取：

```text
标题
难度
题目描述
输入输出
样例
```

---

## Case 3

Agent：

```text
get_problem_markdown
```

获得有效 Markdown。

---

## Case 4

访问不存在题目：

```text
get_problem("not-exist")
```

应收到结构化、安全错误。

不能：

```text
500 stack trace
```

---

## Case 5

尝试访问隐藏题。

匿名 MCP 用户必须：

```text
拒绝
```

或：

```text
Not Found
```

绝对不能泄漏内容。

---

## Case 6

连续调用：

```text
search_problems
```

不会造成：

```text
数据库异常
内存泄漏
MCP session 泄漏
NestJS worker 异常
```

---

# 24. 自动化测试

至少增加：

```text
MCP tools unit test
```

以及：

```text
MCP HTTP integration test
```

重点测试：

```text
tools/list

公开题查询

隐藏题访问

不存在题

非法参数

pageSize 上限
```

如果加入 Nginx / deployment 测试困难，至少提供明确的手工验收步骤。

---

# 25. 不允许破坏现有功能

开发完成必须确认：

```text
npm build
```

正常。

以及：

```text
Web 前端正常

/api/problems 正常

/api/submissions 正常

WebSocket 正常

Judge 正常

CLI 正常
```

MCP 是：

```text
新增入口
```

而不是重构现有 API。

---

# 26. 第二阶段：OAuth + 用户能力

第一阶段验收完成以后，再开始第二阶段。

Remote MCP 只要开始涉及：

```text
用户自己的提交

提交代码

运行代码
```

就必须引入正式 Authentication / Authorization。

不要设计：

```text
login(username, password)
```

这种 MCP Tool。

也不要让 AI Agent：

```text
直接接收用户 ETLOJ 密码
```

远程 MCP 推荐按照 MCP Authorization 标准使用 OAuth 2.1 风格的授权流程。官方文档明确建议涉及用户特定数据和敏感操作的 Remote MCP 使用授权机制。

---

# 27. 第二阶段预期 scopes

建议规划：

```text
problems:read

submissions:read

submissions:write

code:run
```

其中：

```text
problems:read
```

读取题目。

```text
submissions:read
```

查看自己的提交和状态。

```text
submissions:write
```

提交代码。

```text
code:run
```

运行自定义测试。

---

# 28. 第二阶段 Tools

OAuth 完成以后，可以增加：

```text
get_my_problem_status

list_my_submissions

get_submission

submit_solution

run_code
```

预计映射：

```text
get_my_problem_status
        ↓
SubmissionService.getProblemsStatus()
```

```text
list_my_submissions
        ↓
SubmissionService.findAll({
    userId: 当前用户
})
```

```text
get_submission
        ↓
SubmissionService.findOne(
    submissionId,
    当前用户 id,
    当前用户 role
)
```

```text
submit_solution
        ↓
SubmissionService.create(
    当前用户 id,
    dto
)
```

```text
run_code
        ↓
SubmissionService.run(...)
```

所有用户 ID：

**必须来自认证 token。**

绝对不允许 Agent：

```text
传 userId
```

例如绝对不要设计：

```ts
list_my_submissions({
    userId: 123
})
```

应该：

```ts
list_my_submissions({})
```

然后：

```text
MCP auth context
      ↓
current user
      ↓
SubmissionService
```

---

# 29. 高风险 Tool 二次确认

未来加入：

```text
submit_solution

run_code
```

时，应在 Tool description 中明确这是：

```text
会产生真实副作用
```

尤其：

```text
submit_solution
```

会生成真实 OJ Submission。

如果 MCP Client 支持用户确认机制，应让客户端能够在执行前提醒用户。

---

# 30. 永远不要暴露的 MCP Tool

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

特别是当前 Judge callback 使用内部：

```text
x-judge-secret
```

认证，这种接口属于 Judge 与 Backend 内部协议，不能成为 MCP Tool。当前代码确实使用该 secret 保护 Judge callback。

---

# 31. 最终产品形态

最终希望形成：

```text
                         ETLOJ
                           │
             ┌─────────────┼─────────────┐
             │             │             │
            Web           CLI           MCP
             │             │             │
             │          REST API       Agent
             │                           │
             └─────────────┬─────────────┘
                           ↓
                    ETLOJ Business Layer
                           ↓
                 Prisma / Redis / Judge
```

---

# 32. 最终 Agent 使用场景

未来用户可以：

```text
“帮我找 5 道前缀和入门题。”
```

Agent：

```text
search_problems
```

然后：

```text
“打开第 2 道。”
```

Agent：

```text
get_problem
```

未来登录后：

```text
“看看我这道题为什么一直 WA。”
```

Agent：

```text
get_problem
      ↓
list_my_submissions
      ↓
get_submission
      ↓
读取用户本地代码
      ↓
分析问题
```

修改完成：

```text
“帮我提交。”
```

Agent：

```text
submit_solution
      ↓
get_submission
      ↓
AC / WA / TLE
```

最终实现：

```text
读题
 ↓
写代码
 ↓
分析
 ↓
提交
 ↓
获取 Judge 结果
 ↓
继续修改
```

完整 Agent 刷题闭环。

---

# 33. 本次实际开发任务

当前此次开发只要求完成 **Phase 1**：

### 必须完成

- [x] 1. 检查 ETLOJ 当前代码结构。
- [x] 2. 检查官方 MCP TypeScript SDK 当前稳定版本：采用 v2.0.0 拆包结构。
- [x] 3. 接入 `@modelcontextprotocol/server`、`@modelcontextprotocol/node`、`@modelcontextprotocol/client` 和 Zod v4。
- [x] 4. 创建 `McpModule`。
- [x] 5. 创建远程 Streamable HTTP MCP endpoint。
- [x] 6. 实现 `search_problems`、`get_problem`、`get_problem_markdown`。
- [x] 7. 严格限制只能访问公开题。
- [x] 8. 在 Nest 底层 Express adapter 上配置独立 `/mcp`，不受 `/api` 全局前缀影响。
- [x] 9. 修改 Nginx，增加 `/mcp` 反向代理配置。
- [x] 10. 增加 MCP tools 单元测试和 HTTP 集成测试。
- [x] 11. 使用官方 MCP TypeScript SDK Client 完成本地 `initialize`、`tools/list` 和三个 `tools/call` 验证。
- [x] 12. 更新 README 和部署输出。

> 说明：第 11 项当前完成的是本地协议级验证，使用真实 Streamable HTTP 和标准 SDK Client，但 `ProblemService` 为测试替身。生产环境真实题库、公网 URL 及 MCP Inspector GUI 验收仍属于上线步骤。

---

# 34. 本次禁止范围

不要实现：

```text
OAuth

submit_solution

run_code

读取个人提交

管理后台 MCP

教师 MCP

Judge callback MCP

Resources

Prompts

Agent Skill
```

除非 Phase 1 实现过程中发现有强制依赖。

保持：

```text
Small PR

Clear boundary

Minimal changes
```

---

# 35. 完成后请输出开发报告

开发完成后，不要只告诉我：

```text
“已完成。”
```

请提交以下报告：

## A. 修改文件

例如：

```text
server/package.json

server/src/app.module.ts

server/src/main.ts

server/src/mcp/...

nginx/default.conf

README.md
```

---

## B. Architecture

说明：

```text
Agent 请求如何从 /mcp
一路进入 ProblemService。
```

---

## C. MCP Tools

列出：

```text
tool name

description

input schema

output

调用的 ETLOJ Service
```

---

## D. Security

说明：

```text
如何保证匿名 MCP 无法读取隐藏题。
```

---

## E. Testing

列出真实执行过的：

```text
build

unit tests

integration test

MCP initialize

tools/list

tools/call
```

以及实际结果。

---

## F. Deployment

给出部署步骤：

```text
npm install

npm build

restart backend

nginx -t

reload nginx
```

以及最终 MCP URL：

```text
https://etloj.space/mcp
```

---

## G. Remaining TODO

明确标注下一阶段：

```text
OAuth

submissions:read

submissions:write

code:run
```

不要把尚未完成的功能描述成已完成。

---

# 36. 开发原则总结

本任务最重要的原则：

```text
MCP 是 ETLOJ 的 Agent Interface，
不是另一套 ETLOJ Backend。
```

所以：

```text
Web
 ↓

CLI
 ↓       → 同一套 ETLOJ 业务逻辑

MCP
 ↓
```

不要复制：

```text
题库逻辑

权限逻辑

提交逻辑

Judge 逻辑
```

而应该复用现有：

```text
ProblemService

SubmissionService

Auth

Prisma / Redis / Judge
```

第一阶段只证明：

```text
Remote MCP
      ↓
ETLOJ Public Problems
```

稳定、安全、标准可用。

完成这个基础以后，再继续做：

```text
OAuth
 ↓
用户提交
 ↓
Agent 自动刷题工作流
```

---

# 37. Phase 1 当前实施报告（2026-08-10）

## 37.1 结论

Phase 1 的代码开发已经完成，范围保持为 **Public Read-Only MCP**，没有实现 OAuth、提交代码、运行代码、个人提交查询、Resources 或 Prompts。

当前状态分为两部分：

```text
代码实现与本地自动化验收：已完成

生产部署与公网真实数据验收：待执行
```

## 37.2 实际修改文件

```text
README.md
deploy.sh
nginx/default.conf

server/package.json
server/package-lock.json
server/src/app.module.ts
server/src/main.ts

server/src/mcp/mcp.module.ts
server/src/mcp/mcp.service.ts
server/src/mcp/mcp.http.ts
server/src/mcp/tools/problem.tools.ts

server/src/mcp/mcp.service.spec.ts
server/src/mcp/mcp.http.spec.ts
```

服务版本和 MCP Server metadata 已统一更新为：

```text
0.1.0
```

## 37.3 最终实现架构

```text
MCP Client / Agent
        ↓
POST /mcp（以及协议要求的其他 method）
        ↓
Nginx Streamable HTTP 反向代理
        ↓
NestJS 底层 Express adapter
        ↓
createMcpHandler + toNodeHandler
        ↓
McpService 为每个请求创建 McpServer
        ↓
problem.tools.ts
        ↓
ProblemService
        ↓
Prisma / 题目 Markdown 文件
```

MCP 没有调用 CLI，也没有通过 `/api/problems` 做本机 HTTP 转发。

`/mcp` 直接挂载在底层 Express app，因此现有：

```text
/api/*
/ws/*
```

行为保持不变。

## 37.4 MCP Tools

### search_problems

```text
description:
Search public ETLOJ programming problems by keyword, difficulty and tags.

input:
keyword?: string，1～100 字符
difficulty?: ETLOJ Difficulty 枚举
tags?: string[]，最多 10 个，每个最多 50 字符
tagMode?: AND | OR
page?: integer，最小 1
pageSize?: integer，1～50

service:
ProblemService.findAll(query, false)

output:
content + structuredContent
```

### get_problem

```text
description:
Get the public statement and metadata for an ETLOJ problem by numeric id or slug.

input:
problem: string，1～200 字符，支持数字 ID 或 slug

service:
ProblemService.findOne(problem, false)

output:
id、slug、title、difficulty、tags、statement、limits、score、testcaseCount、stats
```

### get_problem_markdown

```text
description:
Get the original Markdown for a public ETLOJ problem by numeric id or slug.

input:
problem: string，1～200 字符，支持数字 ID 或 slug

service:
ProblemService.getMarkdown(problem)

output:
原始 Markdown content + structuredContent
```

三个工具均标记为 read-only、non-destructive、idempotent、closed-world。

## 37.5 安全实现

已实现：

1. `search_problems` 固定调用 `ProblemService.findAll(query, false)`。
2. `get_problem` 固定调用 `ProblemService.findOne(identifier, false)`。
3. `get_problem_markdown` 复用内部固定按匿名权限解析的 `ProblemService.getMarkdown()`。
4. 隐藏题和不存在题统一映射为 `Problem not found.`，避免泄露隐藏题是否存在。
5. 详情和列表输出使用字段白名单，不返回 `filePath`、测试数据或数据库内部字段。
6. 非预期异常只向客户端返回 `Internal ETLOJ error.`，详细 stack trace 仅记录在服务端日志。
7. 日志记录 tool name、MCP request id、执行耗时、成功/失败和匿名 actor，不记录 token、密码或代码。
8. HTTP 入口使用官方 Host header validation，默认允许 `etloj.space`、localhost 和 loopback。
9. 默认按客户端 IP 每 60 秒最多允许 60 次 MCP HTTP 请求，可通过环境变量调整。
10. 工具输入限制 keyword、tags、pageSize、problem identifier 等参数规模。

可选环境变量：

```env
MCP_ALLOWED_HOSTS=etloj.space,localhost,127.0.0.1,[::1]
MCP_RATE_LIMIT_MAX=60
MCP_RATE_LIMIT_WINDOW_MS=60000
```

## 37.6 已执行测试

### MCP 自动化测试

执行：

```bash
cd server
npm test -- --runInBand src/mcp
```

结果：

```text
Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
```

覆盖：

```text
tools/list 精确返回三个 Phase 1 tools
search_problems 固定 isAdmin=false
get_problem 固定 isAdmin=false
隐藏题安全错误
pageSize=51 参数拒绝
Streamable HTTP initialize
HTTP tools/list
HTTP tools/call search_problems
HTTP tools/call get_problem
HTTP tools/call get_problem_markdown
```

HTTP 集成测试使用真实 Express HTTP listener、官方 `StreamableHTTPClientTransport` 和标准 MCP Client；题库业务服务使用测试替身，因此验证的是 MCP 协议、路由、schema、输出及 Service 调用边界，不代表已连接生产数据库。

### 构建与回归检查

实际结果：

```text
server npm run build：通过
新增 MCP 文件 ESLint：通过
client npm run build：通过
CLI test：3 passed
CLI build：通过
Judge TypeScript --noEmit：通过
git diff --check：通过
```

## 37.7 Nginx 与部署

已增加：

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

目标公网 URL 保持为：

```text
https://etloj.space/mcp
```

生产服务器仍需执行：

```bash
cd /opt/etloj/server
npm ci
npm run build
sudo systemctl restart etloj-server

sudo cp /opt/etloj/nginx/default.conf /etc/nginx/sites-available/etloj
sudo nginx -t
sudo systemctl reload nginx
```

当前开发环境为 Windows 且未安装 Nginx，因此尚未执行 `nginx -t`，也尚未重启生产 backend 或 reload 生产 Nginx。

## 37.8 上线后待执行验收

- [ ] 在生产服务器执行 `nginx -t`。
- [ ] 重启 `etloj-server` 并 reload Nginx。
- [ ] 使用标准 MCP Client 或 Inspector 连接 `https://etloj.space/mcp`。
- [ ] 验证生产环境 `initialize` / `server/discover`。
- [ ] 验证生产环境 `tools/list`。
- [ ] 使用真实公开题验证三个 `tools/call`。
- [ ] 使用真实隐藏题确认返回 Not Found 且不泄露题面。
- [ ] 连续调用 `search_problems` 验证生产限流与长期稳定性。
- [ ] 检查生产日志不包含 token、密码、测试数据或内部路径。

## 37.9 Remaining TODO（Phase 2）

尚未实现：

```text
OAuth 2.1 / MCP Authorization
problems:read scope
submissions:read
submissions:write
code:run

get_my_problem_status
list_my_submissions
get_submission
submit_solution
run_code
```

这些能力必须在正式 Authentication / Authorization 完成后再开放。所有 userId 必须来自认证上下文，不允许由 Agent 传入。
