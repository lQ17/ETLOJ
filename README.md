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

## Remote MCP（Phase 1）

ETLOJ 在独立的 `/mcp` 路径提供基于 Streamable HTTP 的公开只读 MCP 服务。MCP 层通过 NestJS 依赖注入直接调用 `ProblemService`，不会通过 CLI 或本机 HTTP API 转发请求。

当前工具：

| Tool | 输入 | 输出 | 业务服务 |
|------|------|------|----------|
| `search_problems` | `keyword?`、`difficulty?`、`tags?`、`tagMode?`、`page?`、`pageSize?` | 公开题目分页列表，同时提供文本和 `structuredContent` | `ProblemService.findAll(query, false)` |
| `get_problem` | `problem`（数字 ID 或 slug） | 公开题目的题面、标签、难度和限制 | `ProblemService.findOne(problem, false)` |
| `get_problem_markdown` | `problem`（数字 ID 或 slug） | 原始 Markdown | `ProblemService.getMarkdown(problem)` |

安全边界：匿名 MCP 只能访问公开题目；隐藏题与不存在的题统一返回 `Problem not found.`。输入 schema 限制关键词长度、标签数量、标识符长度和最大 `pageSize=50`，HTTP 入口默认按客户端 IP 限制为每分钟 60 次请求，并使用官方 Host 校验防护 DNS rebinding。工具输出采用字段白名单，不包含题目文件路径、测试数据或内部异常。

可选环境变量：

```env
# 逗号分隔，不含端口；部署到其他域名时必须加入该域名
MCP_ALLOWED_HOSTS=etloj.space,localhost,127.0.0.1,[::1]
MCP_RATE_LIMIT_MAX=60
MCP_RATE_LIMIT_WINDOW_MS=60000
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

公网 MCP URL：`https://etloj.space/mcp`。可用官方 MCP Inspector，或运行本仓库的 HTTP 集成测试验证真实的 `initialize`、`tools/list` 和 `tools/call`：

```bash
cd server
npm test -- --runInBand src/mcp
```

Phase 2 尚未实现：OAuth、`submissions:read`、`submissions:write` 和 `code:run`。

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
