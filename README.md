# ETLOJ - Easy To Learn Online Judge

> 让 OI 学习更简单

## 简介

ETLOJ 是一个面向学校与社团的在线算法评测平台，致力于通过更友好的交互体验降低 OI（Olympiad in Informatics）的学习门槛。

**核心理念：** 学习算法不应该被工具劝退。ETLOJ 提供清晰的题目展示、即时的判题反馈、以及即将到来的 AI 辅助学习功能，让每一次提交都成为进步的阶梯。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Arco Design + Monaco Editor + KaTeX |
| 后端 | NestJS + TypeScript + Prisma 5 + MySQL 8 + Redis 7 |
| 判题 | go-judge 沙箱 + 独立 Node.js 判题服务 |
| 部署 | Docker Compose + Nginx |

## 功能特性

### 已实现

- **题目系统** — Markdown 题面 + LaTeX 公式支持，管理员可在线创建和管理题目
- **在线判题** — 支持 C / C++ / Java / Python，基于 go-judge 安全沙箱执行
- **用户系统** — JWT 认证，角色权限控制（管理员 / 教师 / 用户）
- **代码编辑器** — Monaco Editor（VS Code 内核），语法高亮与自动补全
- **公告系统** — 管理员发布平台公告，首页公告栏 + 独立公告列表页（Markdown + LaTeX）
- **AI 助手** — 题目详情页接入 AI 辅导教练，基于上下文智能引导，支持流式对话与代码语法高亮
- **AI 监控控制台** — 数据库级别 `AiUsageLog` 流式调用持久化，后台可视化统计大屏（今日/累计 Tokens & 请求数）、支持本日/本周/本月/自定义范围快捷时间过滤及供应商/模型实时检索明细日志，首页集成 AI 实时交互卡片（带数值增长动效）

### 规划中

- **技能树** — 可视化知识点掌握进度，点亮你的算法技能图谱
- **算法可视化** — 动态演示排序、搜索、图论等算法的执行过程
- **比赛系统** — ACM / OI 双模式，实时排行榜
- **讨论区** — 题目交流社区

## 快速开始

### 环境要求

- Node.js >= 20（Remote MCP SDK v2 要求）
- MySQL 8.x
- Redis 7.x
- go-judge（可选，判题需要）

### 安装

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/etloj.git
cd etloj

# 后端
cd server
npm install
cp .env.example .env    # 配置数据库连接
npx prisma db push       # 同步数据库
npm run seed             # 创建初始管理员 (admin / admin123)
npm run start:dev

# 前端
cd ../client
npm install
npm run dev

# 判题服务（可选）
cd ../judge
npm install
npm run start
```

### 访问

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api
- Remote MCP：http://localhost:3000/mcp
- 初始管理员：`admin` / `admin123`

## Remote MCP（Phase 2）

ETLOJ 提供两个基于 Streamable HTTP 的 MCP 入口：`/mcp` 保持匿名公开只读兼容，`/mcp/private` 使用正式 OAuth 2.1 Authorization Code + PKCE 授权并提供个人学习进度。MCP 层通过 NestJS 依赖注入直接调用业务 Service，不通过 CLI 或本机 HTTP API 转发请求。

当前工具：

| Tool | 输入 | 输出 | 业务服务 |
|------|------|------|----------|
| `list_tags` | `keyword?` | 仅由公开题目使用的完整标签列表及公开题目数量 | `TagService.findPublicTags(keyword)` |
| `search_problems` | `keyword?`、`difficulty?`、`tags?`、`tagMode?`、`page?`、`pageSize?` | 公开题目分页列表，同时提供文本和 `structuredContent` | `ProblemService.findAll(query, false)` |
| `get_problem` | `problem`（数字 ID 或 slug） | 公开题目的题面、标签、难度和限制 | `ProblemService.findOne(problem, false)` |
| `get_problem_markdown` | `problem`（数字 ID 或 slug） | 原始 Markdown | `ProblemService.getMarkdown(problem)` |
| `list_problem_lists` | `keyword?`、`page?`、`pageSize?` | 公开题单及仅公开题目的计数 | `ProblemListService.findAllPublicForMcp(...)` |
| `get_problem_list` | `listId` | 公开题单与连续编号的公开题目 | `ProblemListService.findOnePublicForMcp(id)` |
| `get_my_problem_status` | `problemIds` | 当前授权用户对公开题目的三态进度 | `SubmissionService.getMyPublicProblemStatus(...)` |
| `list_my_submissions` | 安全分页、题目、状态、语言、时间筛选 | 当前授权用户的提交摘要 | `SubmissionService.listMyPublicSubmissions(...)` |
| `get_submission` | `submissionId` | 当前授权用户的最小化提交详情（不含源代码正文） | `SubmissionService.getMyPublicSubmission(...)` |

安全边界：匿名 MCP 只能访问公开数据；标签和题单计数只依据公开题目，隐藏题不会影响条目、数量或顺序；私有/不存在题单和隐藏/不存在题目分别使用统一安全错误。个人入口的 userId 仅来自验证后的 access token，Tool schema 不接受 userId，教师和管理员的 `my` 工具同样只读取自身数据。每个个人 Tool 独立校验 `problems:read` 或 `submissions:read`，输出字段白名单不包含 access token、完整源代码、题目文件路径、测试数据或内部异常。

Authorization 采用 MCP 2026-07-28 规范：资源服务器通过 RFC 9728 Protected Resource Metadata 指向同源 Authorization Server；Authorization Server 发布 RFC 8414 metadata，支持公开客户端动态注册、Authorization Code + PKCE S256、RFC 8707 `resource`、一小时 access token、刷新令牌轮换和 RFC 7009 撤销。网页登录 JWT 仅用于授权确认页识别资源所有者，不作为 MCP access token，也不通过 Tool 参数传递。

可选环境变量：

```env
# 逗号分隔，不含端口；部署到其他域名时必须加入该域名
MCP_ALLOWED_HOSTS=etloj.space,localhost,127.0.0.1,[::1]
MCP_RATE_LIMIT_MAX=60
MCP_RATE_LIMIT_WINDOW_MS=60000
# 生产默认 https://etloj.space；本地授权联调时可覆盖
MCP_PUBLIC_BASE_URL=https://etloj.space
```

生产部署必须在本机完成构建，服务器不得执行 `npm install` / `npm ci` / `npm run build`。先在本机运行：

```bash
cd server
npm test -- --runInBand
npm run build
cd ../client
npm run build
```

部署时只上传 `server/dist` 与 `client/dist` 等本地产物（部署包必须排除所有 `.env`、密钥和题目数据），在服务器保留回滚备份后替换后端产物；前端先清理 `/var/www/etloj` 的旧 hash 文件再复制新产物。本阶段无 Prisma schema 变化。若同步 Nginx 配置，必须执行：

```bash
sudo systemctl restart etloj-server

sudo cp /opt/etloj/nginx/default.conf /etc/nginx/sites-available/etloj
sudo nginx -t
sudo systemctl reload nginx
```

公网匿名 URL：`https://etloj.space/mcp`；登录 URL：`https://etloj.space/mcp/private`。支持 OAuth 的标准 MCP Client 连接登录 URL 后会从 401 challenge 自动发现 Authorization Server、打开 ETLOJ 登录/授权页并携带 Bearer token 重试。可运行以下测试验证 `initialize`、`tools/list`、`tools/call`、发现、PKCE、token、scope 与撤销：

```bash
cd server
npm test -- --runInBand src/mcp src/problem-list src/submission/submission.mcp.spec.ts
```

本阶段明确不提供 `submissions:write`、`code:run`、提交/运行代码、管理员/教师专用 MCP、Judge callback、任意 SQL/Shell/HTTP 工具。

## 项目结构

```
etloj/
├── client/          # React 前端
├── server/          # NestJS 后端
├── judge/           # 判题服务
├── problems/        # 题目 Markdown 文件
├── docker-compose.yml
└── PROGRESS.md      # 开发进度
```

## License

Private - All rights reserved.
