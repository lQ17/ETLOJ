# ETLOJ — Easy To Learn Online Judge

> 让 OI 学习更简单。

ETLOJ 是面向学校、社团和算法学习者的在线评测平台，提供题目管理、安全判题、学习记录、算法可视化、AI 辅导和 MCP 接入。

- 在线站点：[https://etloj.space](https://etloj.space)
- 公开 MCP：[https://etloj.space/mcp](https://etloj.space/mcp)
- OAuth 个人 MCP：[https://etloj.space/mcp/private](https://etloj.space/mcp/private)

## 已实现功能

- Markdown + LaTeX 题面，ZIP 批量导入导出，标签和多条件筛选
- C、C++、Java、Python 在线判题，go-judge 沙箱隔离
- WebSocket 实时结果推送，并保留 HTTP 轮询兜底
- 注册申请、Turnstile 人机验证、管理员审核和 USER/TEACHER/ADMIN 权限
- 公共及个人题单、提交记录、排名、个人主页与首次 AC 计分
- 题解发布、编辑和审核
- 公告、教学反馈分享及公开反馈页面
- 排序、搜索、前缀和、差分、图搜索等算法可视化
- AI 辅导、流式回答、配额管理、Provider/Prompt 配置与用量监控
- 匿名只读 MCP、OAuth 2.1 个人 MCP、学习进度工具和受限管理员测试数据工具

尚未完成：比赛业务、讨论区和技能树。Prisma 中的 Contest 模型不代表比赛功能已经可用。

## 架构

```text
Browser -> Nginx -> React 静态文件
                 -> NestJS API / WebSocket / MCP
NestJS -> MariaDB + Redis
Redis -> Node.js Judge -> go-judge sandbox
```

| 组件 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Arco Design、Monaco、KaTeX |
| 后端 | NestJS 11、Prisma 5、MariaDB/MySQL、Redis |
| 判题 | Node.js Judge、go-judge v1.9.0 |
| 生产 | Debian、systemd、Nginx；另提供可选 Docker Compose 方案 |

## 本地开发

### 环境要求

- Node.js 20+
- MariaDB 10.11+/MySQL 8+
- Redis 7+
- C/C++、Java、Python 编译环境（本地 Judge 模式需要）

### 1. 获取代码

```bash
git clone https://github.com/lQ17/ETLOJ.git
cd ETLOJ
```

### 2. 启动后端

在 `server/.env` 中配置：

```env
DATABASE_URL=mysql://root:your-password@127.0.0.1:3306/etloj
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=replace-with-a-long-random-secret
JUDGE_SECRET=replace-with-an-independent-random-secret
PROBLEMS_DIR=../problems
CLIENT_ORIGIN=http://localhost:5173
MCP_PUBLIC_BASE_URL=http://localhost:3000
MCP_ALLOWED_HOSTS=localhost,127.0.0.1,[::1]
MCP_RATE_LIMIT_MAX=60
MCP_RATE_LIMIT_WINDOW_MS=60000
# 管理员测试数据 MCP 的可选安全限制（不填时使用服务端默认值）
MCP_TESTCASE_MAX_FILE_BYTES=1048576
MCP_TESTCASE_READ_CHUNK_CHARS=32768
MCP_TESTCASE_READ_MAX_CHARS=65536
MCP_TESTCASE_MAX_COUNT=1000
MCP_ADMIN_WRITE_RATE_LIMIT_MAX=10
MCP_ADMIN_WRITE_RATE_LIMIT_WINDOW_MS=60000
# 本地开发可使用 Cloudflare 官方测试 Secret
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

首次创建管理员前设置强密码，再执行 `npm run seed`。变量名为 `ADMIN_SEED_PASSWORD`；未设置时会生成随机密码并只在终端输出。

### 3. 启动前端

```bash
cd client
npm install
npm run dev
```

### 4. 启动本地 Judge

Judge 的 `JUDGE_SECRET` 必须与 Server 一致。Linux/macOS：

```bash
cd judge
npm install
JUDGE_MODE=local REDIS_URL=redis://127.0.0.1:6379 SERVER_URL=http://127.0.0.1:3000 JUDGE_SECRET=your-judge-secret npx tsx src/index.ts
```

PowerShell：

```powershell
cd judge
npm install
$env:JUDGE_MODE='local'; $env:REDIS_URL='redis://127.0.0.1:6379'; $env:SERVER_URL='http://127.0.0.1:3000'; $env:JUDGE_SECRET='your-judge-secret'; npx tsx src/index.ts
```

本地模式没有生产沙箱隔离能力，也不提供准确内存统计，不能用于公开服务。

访问地址：前端 `http://localhost:5173`，API `http://localhost:3000/api`，MCP `http://localhost:3000/mcp`。

## 使用 Docker Compose 部署

这是供独立 Linux 主机自托管的可选方案；ETLOJ 官方生产环境仍使用 `CLAUDE.md` 中的裸机 systemd 流程。

要求：Docker Engine、Docker Compose v2，以及支持 cgroup 的 Linux 主机。[go-judge 官方容器](https://github.com/criyle/go-judge)需要 `privileged` 权限，因此不要在不可信的共享 Docker 主机上运行，也不要把 5050 端口发布到公网。

### 1. 配置

```bash
cp docker/.env.example docker/.env.docker
mkdir -p data/problems
```

编辑 `docker/.env.docker`，替换所有密码和密钥。`MYSQL_PASSWORD` 建议只使用字母、数字、`-` 和 `_`，避免拼入 `DATABASE_URL` 后需要额外编码；部署到域名时，同时修改 `PUBLIC_ORIGIN` 和 `MCP_ALLOWED_HOSTS`。生产 Turnstile 必须换成真实 Secret。MCP 全局限流与管理员测试数据写入限流可在环境变量中设置初始值，管理员也可在 `/admin` 的“MCP 配额”页即时调整；界面修改值会持久化到 Redis，服务重启后仍然保留。默认值已按保守上限配置，只有在完成安全评审后才应放宽。

### 2. 构建并初始化

```bash
docker compose --env-file docker/.env.docker build
docker compose --env-file docker/.env.docker up -d mariadb redis gojudge
docker compose --env-file docker/.env.docker run --rm server npx prisma db push --skip-generate
docker compose --env-file docker/.env.docker up -d
docker compose --env-file docker/.env.docker exec server node dist/src/seed.js
```

默认入口为 `http://localhost:8080`。公网部署建议在 Compose 外层使用 Caddy、Traefik 或宿主机 Nginx 终止 HTTPS。

### 3. 验证与运维

```bash
docker compose --env-file docker/.env.docker ps
docker compose --env-file docker/.env.docker logs -f server judge gojudge
curl http://localhost:8080/api/stats
```

持久化数据：MariaDB 使用 `mariadb_data` volume，Redis 开启 AOF 并使用 `redis_data` volume，题目文件保存在宿主机 `data/problems`。升级前先备份这些数据；不要使用 `docker compose down -v`，它会删除数据库和 Redis volume。

Compose 固定使用 `criyle/go-judge:v1.9.0`，不可改成 `latest`。Docker Desktop 的 Windows/macOS 沙箱不适合作为公开生产判题环境。

## Remote MCP

- `/mcp`：匿名公开只读，可查询公开题目、标签和题单。
- `/mcp/private`：OAuth 2.1 Authorization Code + PKCE，可查询授权用户自己的学习进度和提交摘要。
- `/mcp/private` 的管理员工具仅对实时角色为 `ADMIN` 且显式获得对应 scope 的令牌呈现：
  - `testcases:read`：`list_problem_testcases`、`get_problem_testcase`，读取测试点元数据、输入和标准输出。
  - `testcases:write`：`add_problem_testcase`、`delete_problem_testcase`，追加或删除测试点；这是高风险写权限，可能影响后续判题结果。
- 普通用户、教师和匿名客户端不会看到或调用管理员测试数据工具；管理员也必须逐项申请 scope，不能依靠角色绕过权限检查。
- 个人工具的 userId 只来自 access token；不接受调用者自行传入 userId，也不返回完整源代码、测试数据、文件路径或内部异常。
- 当前不提供 MCP 写入提交、运行代码、除测试数据外的管理员操作、SQL、Shell 或任意 HTTP 工具。

MCP 的协议设计与安全说明见 [ETLOJ 远程 MCP 服务开发建议与实施任务书.md](./ETLOJ%20远程%20MCP%20服务开发建议与实施任务书.md)。

运行相关测试：

```bash
cd server
npm test -- --runInBand src/mcp src/problem-list src/submission/submission.mcp.spec.ts
```

## 测试与构建

```bash
cd server && npm test && npm run build
cd ../client && npm run build
cd ../judge && npm test && npm run typecheck && npm run build
```

## 生产部署

官方生产环境是 Debian 裸机部署，不使用 Docker。必须在本地完成构建，只上传制品，并保留 `.env`、数据库、题目数据和回滚备份。旧 `deploy.sh` 不能用于生产更新。

完整的队列可靠性、go-judge 版本、原子发布、验收和回滚要求见 [CLAUDE.md](./CLAUDE.md)。

## 目录

```text
client/              React 前端
server/              NestJS 后端
judge/               Node.js 判题服务
docker/              可选 Compose 镜像与 Nginx 配置
deploy/              裸机 systemd unit
nginx/               裸机生产 Nginx 配置
problems/            本地开发题目目录
data/problems/       Docker 自托管题目持久化目录（运行时创建）
docker-compose.yml   可选完整容器编排
CLAUDE.md            项目约束与官方生产运行手册
```

## License

Private — All rights reserved.
