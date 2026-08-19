# CLAUDE.md

本文件只记录 ETLOJ 特有的架构约束、易错点和生产部署要求。常规的 NestJS、React、TypeScript 开发惯例不在此重复。

## 项目结构

- `server/`：NestJS 11 后端，Prisma 5 + MariaDB + Redis，全局 API 前缀 `/api`
- `client/`：React 18 + Vite + Arco Design + Monaco Editor
- `judge/`：独立 Node.js 判题服务，生产环境调用 go-judge 沙箱
- `nginx/`：生产 Nginx 配置
- `deploy/`：systemd unit 模板
- `docker/`、`docker-compose.yml`：供独立 Linux 主机自托管的可选容器方案，不用于 ETLOJ 官方生产机

用户可见文案以中文为主；代码、日志和内部注释可使用中英文。

## 常用命令

```bash
# server（默认 3000）
cd server
npm install
npm run start:dev
npm test
npm run build

# client（默认 5173）
cd client
npm install
npm run dev
npm run build

# judge（本地模式无沙箱、无准确内存统计）
cd judge
npm install
npm test
npm run typecheck
npm run build

# Windows 本地启动 judge
set JUDGE_MODE=local && set SERVER_URL=http://127.0.0.1:3000 && npx tsx src/index.ts
```

Windows 上执行 `prisma generate` 或 `prisma db push` 前先停止开发服务器，否则 Prisma 原生 DLL 可能因文件锁报 EPERM。

## 提交与判题

### 正式提交

1. 客户端向 `POST /api/submissions` 提交代码（JWT）。
2. Server 创建 `PENDING` Submission，从文件系统加载测试点，将任务 `LPUSH` 到 `judge:queue`。
3. Judge 使用 `BRPOPLPUSH` 将任务原子移动到 `judge:queue:processing`，再编译并运行全部测试点。
4. Judge 使用 `x-judge-secret` 回调 `POST /api/submissions/callback`。
5. 回调成功后，Judge 才从 processing 队列确认删除任务；进程重启时会把遗留 processing 任务恢复到待判队列。
6. 400、404、422 等永久回调失败进入 `judge:queue:dead`；临时网络或 5xx 错误持续退避重试，不能静默丢弃结果。
7. Server 更新数据库并通过 `/ws/submissions` 推送结果；客户端同时保留 1.5 秒 HTTP 轮询作为竞态和断线兜底。

以下约束不可破坏：

- `judge:queue` 和 `judge:run` 是两个无限阻塞队列，必须使用两个独立 Redis 连接。
- 正式任务只有在回调被 Server 接受后才能从 `judge:queue:processing` 删除。
- 修改消费循环后必须测试：连续两次正式提交、运行代码任务、两类任务并发、回调失败和进程重启恢复。

### 运行代码

`POST /api/submissions/run` 不创建数据库记录。Server 生成 `runId`，将任务放入 `judge:run`，轮询 `judge:run:result:{runId}`；Judge 单独消费该队列并写入带过期时间的结果键。

### WebSocket

- 路径：`/ws/submissions`
- 客户端先通过 JWT 请求 `POST /api/submissions/ws-ticket`，再用短期 ticket 建立 WebSocket。
- 普通用户只能订阅自己的提交；TEACHER/ADMIN 可按权限查看其他提交。
- 无 ticket、无效账号、停用或未审核账号必须拒绝连接。
- WebSocket 是加速通道，HTTP 查询仍是必要兜底，不能移除。

## 权限与账号

- 公开注册是“申请制”：`POST /api/auth/register` 通过 Cloudflare Turnstile 后创建 `PENDING` USER，管理员审核通过后才能登录。
- 被拒用户可通过 `/api/auth/reapply` 重新申请。
- JWT 解析必须实时检查数据库中的 `isActive` 和审核状态；停用或不再是 `APPROVED` 的旧 token 立即失效。
- 角色：`USER`、`TEACHER`、`ADMIN`，没有 STUDENT 角色。
- 普通用户只能查看自己的提交代码；TEACHER/ADMIN 可查看全部。
- 公开题解列表只能返回 `APPROVED` 内容；作者可查看自己的待审核或驳回题解，管理端可审核。
- 前端“每分钟最多三次提交”只是交互限制，不是安全边界；需要可靠限流时必须在 Server/Redis 实现。

## 项目特有的数据与后端约束

- Prisma 固定 v5，不升级到 v7；当前没有 migration 流程，schema 变更使用 `db push`，生产操作必须先备份并审查风险。
- 生产题目目录：`/opt/etloj/data/problems`。
- 题面：`{slug}/problem.md`；测试点：`{slug}/testcases/{n}.in` 与 `{n}.out`。
- ZIP 导入格式：`{slug}/problem.json`、`problem.md`、`testcases/`；导入必须限制路径穿越、文件数量、单文件与解压后总大小。
- 题目 ID 路由同时接受数字 ID 和 slug；控制器中的固定路由（例如 `me/*`、`mine`）必须写在 `:id` 之前。
- `Problem.tags` JSON 字段只用于导入导出兼容；筛选和统计使用 `ProblemTag` 关系表。
- 难度常量在 `client/src/constants/difficulty.ts` 和 `server/src/problem/difficulty.constants.ts` 两侧维护，修改时必须同步。
- 首次 AC 才计入用户总分、热力图和标签统计。
- 支持语言固定为 C、C++、Java、Python，Judge 与 DTO 必须同步。
- MySQL 原始 SQL 的 `COUNT/SUM` 可能返回 BigInt，LongText 可能返回 Buffer，响应前需要转换。

## AI 与 MCP

- AI Provider 和 Prompt 配置以数据库中的 `AiProvider`、`AiPromptConfig` 为主；Redis 保存全局限额等运行配置，环境变量仅作回退。
- AI SSE 直接解析兼容 `reasoning_content` 的上游流，只向用户输出最终回答。
- 隐藏测试点、标准答案或其他不可见题目上下文不得发送给普通用户的 AI 请求。
- MCP 由 `McpModule` 提供，生产入口包括 `/mcp`、`/mcp/private` 和 OAuth discovery；它们不受 Nest 全局 `/api` 前缀影响。

## 生产环境

裸机 Debian 12，2C2G，无 Docker：

```text
用户 -> Nginx :80/:443 -> /var/www/etloj
                       -> /api、/ws、/mcp -> Server :3000
Server/Judge <-> Redis/MariaDB
Judge -> go-judge 127.0.0.1:5050
```

- 主机：`root@150.158.39.151`（SSH key 已配置）
- Server：`/opt/etloj/server`，systemd `etloj-server.service`，运行 `node dist/src/main.js`
- Judge：`/opt/etloj/judge`，systemd `etloj-judge.service`，运行 `node dist/index.js`
- go-judge：systemd `etloj-go-judge.service`
- 前端：`/var/www/etloj`
- Nginx：`/etc/nginx/sites-available/etloj`
- Server 环境变量：`/opt/etloj/server/.env`
- Judge 环境变量：`/opt/etloj/judge/.env`

生产 unit 可能带有内存限制、Node heap 和 go-judge `-parallelism 2` 等现场调优。更新 unit 前必须先读取线上版本并保留这些参数，不能直接用仓库模板覆盖。

### Nginx 路由

- `/api/` -> `127.0.0.1:3000`
- `/api/ai/` -> Server，SSE 关闭 buffering，读写超时 300 秒
- `/ws/` -> Server，必须设置 HTTP/1.1、Upgrade、Connection，长连接超时 86400 秒
- `/mcp`、`/mcp/private`、`/.well-known/oauth-*` -> Server
- `/` -> `/var/www/etloj` SPA
- `client_max_body_size` 当前要求 100m

仓库当前普通 `/api/` 的 `proxy_read_timeout` 是 30 秒；大量 ZIP 导入若可能超过该时间，必须先调整并验证 Nginx 配置，不能在文档中假定它已经是 300 秒。

## 生产部署规则

### 禁止事项

- `deploy.sh` 是旧的首次部署脚本，**禁止用于生产更新**。它包含服务器端 `git checkout`、`npm ci`、构建和高风险 `db push`，与当前发布要求冲突。
- 生产机禁止执行 `npm install`、`npm ci`、Nest/Vite/TypeScript 构建或 Prisma Client 生成。
- 禁止覆盖任何 `.env`、证书、密钥、数据库文件和 `/opt/etloj/data/problems`。
- 禁止升级或替换现有 go-judge v1.9.0。
- 禁止直接清空 `/var/www/etloj` 后再复制前端；必须使用完整暂存目录进行原子交换。
- 禁止在未备份、未审查影响时执行 `db push --accept-data-loss`。

### 构建与制品

所有构建在本地完成：

- Server：测试、`nest build`，并在 Linux/WSL 环境准备生产 `node_modules` 和 Prisma Debian OpenSSL 3 引擎。
- Client：`vite build`。
- Judge：测试、typecheck、`tsc`，生产运行 `dist/index.js`；依赖变化时同时准备 Linux 生产依赖。
- 发布包必须排除所有 `.env`、`secrets.env`、题目目录、备份、证书和开发缓存。
- 上传前后计算 SHA-256，远端校验一致后才能解压。

### 发布顺序

1. 记录当前 commit、服务状态、磁盘、API 统计和 Redis 队列长度。
2. 确认 `judge:queue`、`judge:queue:processing`、`judge:queue:dead`、`judge:run`；需要停机时先排空正式任务。
3. 备份现有 Server/Judge dist、运行依赖、前端、systemd unit 和 Nginx 配置；schema 变化时额外备份数据库。
4. 上传到 `/opt/etloj/releases/<commit>/`，扫描内容并核对哈希。
5. 在旁路目录解压和检查，停止对应服务后用目录重命名交换；保留 `*.pre-<commit>` 或等价回滚目录。
6. 前端必须整目录交换，避免新旧 hash 静态文件混用。
7. 只重启本次变更涉及的服务；部署 Judge 前后不得删除 Redis 队列。
8. 验收完成后再恢复或确认 Nginx 公网流量。

仅 schema 变化时：先备份数据库并审查变更，在本地 Linux 环境生成匹配的 Prisma Client；上传 schema、生成后的 Linux client 和服务制品。生产端只允许在明确确认无破坏后执行 `npx prisma db push --skip-generate`，不得静默忽略错误。

### 上线验收

- `nginx`、`etloj-server`、`etloj-judge`、`etloj-go-judge`、MariaDB、Redis 全部 active。
- `/api/stats` 与部署前核心数据一致，HTTPS 首页和静态资源正常。
- go-judge 版本仍为 v1.9.0，只监听 `127.0.0.1:5050`，公网 5050 不可访问。
- go-judge 执行冒烟通过。
- Redis 中能看到两个独立阻塞消费者：正式队列为 `brpoplpush`，运行代码队列为 `brpop`；不能共用一个连接。
- 连续正式提交至少两次，并穿插一次运行代码；结果均能及时返回，processing 和 dead 队列无异常残留。
- WebSocket 无 ticket 被拒绝，合法订阅能收到结果；HTTP 轮询兜底正常。
- 检查部署后的 fatal、uncaught、unhandled、error 日志以及内存占用。

### 回滚

回滚前先停止对应消费者，保存当前 Redis 队列快照；如果 processing 中有任务，必须先安全恢复到待判队列。然后恢复上一版目录、unit/Nginx 配置并启动服务，最后重新执行完整验收。不要通过清空 Redis 或覆盖数据目录来回滚。

## go-judge 固定要求

- 版本锁定 v1.9.0。v1.10+，尤其 v1.12.0，在当前 Debian 12 / Linux 6.1 / cgroup v2 环境可能因 `clone3(CLONE_INTO_CGROUP)` 导致全部执行失败。
- HTTP 只监听 `127.0.0.1:5050`，生产建议保留 `-parallelism 2` 和现有内存限制。
- v1.9.0 的 stdin 文件必须使用 `{"src":"/dev/null"}` 或 `{"content":"..."}`，不能传空对象。
- 引用编译产物使用 `{"fileId":"..."}`，不是新版的 `file`。
- 返回状态是字符串，例如 `Accepted`、`Time Limit Exceeded`。
- `etloj-go-judge.service` 的 `TasksMax=infinity`、`LimitNPROC=infinity` 和启动后的 `pids.max` 修正不可删除。

## 其他不可忽略的约束

- JWT 有效期 7 天，但账号状态每次鉴权实时校验。
- Contest 模型仅存在于 Prisma schema，目前没有完整业务模块。
- 本地 Judge 使用 `spawnSync`，没有生产沙箱隔离能力，只能用于开发。
- 题目、测试点和生产数据均不进入 Git。
