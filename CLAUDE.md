# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ETLOJ is an online judge platform with three independent components:

- **server/** — NestJS backend (Prisma 5 + MySQL + Redis), global API prefix `/api`
- **client/** — React 18 frontend (Vite + Arco Design + Monaco Editor)
- **judge/** — Standalone Node.js judge service (single file `src/index.ts`)

All user-facing text, error messages, and comments are in Chinese.

## Development Commands

```bash
# Server (port 3000)
cd server && npm install
npm run start:dev          # dev with watch
npx prisma db push         # sync schema to DB (no migration system)
npm run seed               # create admin user + sample problem

# Client (port 5173, proxies /api -> localhost:3000)
cd client && npm install
npm run dev

# Judge service (requires running Redis)
cd judge && npm install
set JUDGE_MODE=local && set SERVER_URL=http://localhost:3000 && npx tsx src/index.ts  # Windows local mode
JUDGE_MODE=local SERVER_URL=http://localhost:3000 npx tsx src/index.ts                # Linux/Mac
```

**Prisma on Windows**: Stop the dev server before running `prisma generate` or `prisma db push` — the running process locks the native DLL and causes EPERM errors.

## Architecture

### Submission/Judging Flow (end-to-end)

1. Client posts code to `POST /api/submissions` (JWT auth)
2. Server creates Submission (status=PENDING), loads testcases from filesystem, pushes JSON task to Redis list `judge:queue`
3. Judge service `brPop`s the task, compiles & runs all testcases (no short-circuit), calculates `score = round(passedCount / totalCount * 100)`
4. Judge POSTs result to `/api/submissions/callback` with `x-judge-secret` header
5. Server updates Submission with status/timeUsed/memoryUsed/score
6. Client polls `GET /api/submissions/:id` for result display

### Test-Run Flow (Self-test)

1. Client posts code and custom input to `POST /api/submissions/run`
2. Server generates `runId`, pushes JSON task to Redis list `judge:run`, and synchronously polls Redis key `judge:run:result:{runId}`
3. Judge service `brPop`s from `judge:run` (alongside `judge:queue`), compiles & runs once, then sets the result directly to the Redis key
4. Server returns the result directly to the client (no database record created)

### Backend Patterns (NestJS)

- **Modules**: AuthModule, UserModule, ProblemModule, SubmissionModule, RankingModule, ProblemListModule, TagModule, SolutionModule, AnnouncementModule — each with controller, service, dto/
- **Problem import/export**: `POST /problems/export` (zip by slugs), `POST /problems/export-all`, `POST /problems/import` (multipart zip upload) — ADMIN/TEACHER only
- **PrismaModule** is `@Global()` — inject `PrismaService` anywhere without importing
- **Auth**: JWT + Passport (`jwt.strategy.ts`), `JwtAuthGuard`, `RolesGuard` + `@Roles()` decorator, `@CurrentUser()` param decorator
- **Global validation**: `ValidationPipe` with `whitelist: true, transform: true`
- **Body limit**: `express.json({ limit: '5mb' })` configured in `main.ts` for Base64 avatar uploads
- **Problem routing**: All `:id` params accept both numeric ID and slug string — `parseIdOrSlug()` helper in controllers, `resolveProblem()` in service
- **Route priority**: In controllers with both `me/*` and `:id` routes, `me/*` MUST be defined before `:id` — NestJS matches top-to-bottom and `:id` captures "me" as a param
- **Profile module**: `ProfileController` (public, no auth guards) serves `GET /api/profile/:username` and `/api/profile/:username/stats`
- **Ranking module**: `GET /api/ranking` with params `mode`(ac/score), `range`(all/6m/1m/1w/yesterday/today/custom), `startDate`, `endDate`, `page`, `pageSize` — uses `$queryRawUnsafe` for complex aggregation
- **ProblemList module**: `GET/POST/PATCH/DELETE /api/problem-lists` — 题单系统，公共题单（ADMIN/TEACHER 管理）和个人题单（用户自管）；`/mine` 路由必须在 `/:id` 之前；题目增删使用 slug（题号）而非数字 ID
- **Tag module**: `GET /tags`（公开）、`POST/PATCH/DELETE /tags`（ADMIN/TEACHER）— 独立标签管理；题目通过 `ProblemTag` 多对多关联表关联标签；`Problem.tags` JSON 字段保留用于导入导出兼容；`GET /problems` 支持 `tags`（字符串数组）+ `tagMode`（AND/OR）多标签筛选
- **Solution module**: `GET /solutions?problemId=X`（公开，仅 APPROVED）、`GET /solutions/mine`（JWT，当前用户全部题解含 status/rejectReason）、`POST /solutions`（JWT）、`PATCH/DELETE /solutions/:id`（JWT，仅作者可编辑且 PENDING/REJECTED 状态，Admin 可删除）— 题解审核系统：新题解默认 PENDING，管理员通过 `PATCH /solutions/:id/approve` 或 `/reject`（附 reason）审核；`GET /solutions/pending` 和 `GET /solutions/admin` 为管理员专用；题目详情页"查看题解"tab 右侧为 markdown 渲染（选中切换），"写题解"通过居中 Modal 编辑（草稿在组件 state 持久化）；个人主页"我的题解"区块显示审核状态标签（已通过/正在审核/被驳回），被驳回显示原因，已通过隐藏编辑按钮
- **Problem markdown heading**: 服务器在 `create()` / `update()` 时自动将 `problem.md` 第一行强制为 `# {slug} {title}`；编辑页面加载时剥离该 heading（由表单字段生成）；详情页直接渲染
- **Submission status batch query**: `GET /submissions/status?problemIds=1,2,3` — JWT required, returns `Record<number, 'AC' | 'ATTEMPTED'>` for the current user; used by problem list and problem-list detail pages to show per-problem status icons
- **Submission rate limiting**: Frontend sliding window — max 3 submissions per 60s per user (client-side `useRef<number[]>` timestamp array)
- **Optional JWT**: 需要同时支持已登录和未登录访问的端点（如题单详情、题库列表），使用 `OptionalJwtGuard`（`auth/optional-jwt.guard.ts`），有 token 解析用户，无 token 放行
- **Announcement module**: `GET /announcements`（公开，PUBLISHED，置顶优先）、`GET /announcements/:id`（公开详情）、`GET /announcements/admin/all`（ADMIN，含草稿分页）、`GET /announcements/admin/:id`（ADMIN，任意状态详情）、`POST /announcements`（ADMIN）、`PATCH/DELETE /announcements/:id`（ADMIN）— 公告系统：首页公告栏显示 2 条 + "查看更多"跳转列表页；列表页左侧列表 + 右侧 Markdown/LaTeX 详情，默认选中置顶公告；后台"公告管理"Tab 仅 ADMIN 可见，使用 MDEditor 编辑（与题目创建页相同），支持置顶 + 草稿/已发布状态
- **Admin page**: Unified `/admin` route with Tabs (problems / lists / solutions / announcements / users); users + announcements tabs visible to ADMIN only; teachers see problems + lists + solutions; solutions tab has sub-tabs: 待审核 + 题解列表
- **Raw SQL pitfalls**: MySQL `COUNT(*)`/`SUM()` via `$queryRawUnsafe` returns BigInt (must `Number()`); LongText fields return Buffer (must `.toString()`). Avatar in DB already contains `data:image/...;base64,` prefix — frontend should use `src={avatar}` directly, not re-prepend

### Frontend Patterns

- **State**: Zustand (`stores/auth.ts`) — user/token/login/logout; login fetches full profile (including avatar) immediately after token set
- **UI**: Arco Design (`@arco-design/web-react`) — never use other component libraries
- **Charts**: ECharts via `echarts-for-react` — used in profile page for pie, wordCloud (requires `echarts-wordcloud` plugin); heatmap uses `react-github-calendar`
- **Problem detail submit**: Submit button is async — disabled during polling, result (status tag + score + time/memory) displayed inline next to button; rate-limited to 3 submissions per 60s (sliding window)
- **Problem detail page tabs**: Left sidebar navigation with three tabs — 题目详情 (problem text + code editor, 40%/60% split), 查看题解 (solution list + markdown rendering, write via Modal), 问问AI (placeholder); supports `?tab=solutions&edit={solutionId}` query params for deep-linking to edit mode from profile page
- **Editor settings**: Gear icon in editor toolbar opens popover for fontSize (default 16px), tabSize (default 4), theme (亮色/暗色/跟随网站); persisted to localStorage
- **Editor defaults**: No default code templates, code completion disabled (quickSuggestions/suggestOnTriggerCharacters/wordBasedSuggestions all false)
- **API layer**: `client/src/api/*.ts` — plain objects with async methods using shared Axios instance (auto-attaches JWT, unwraps response, 30s timeout); custom `paramsSerializer` for proper array query parameter serialization (`tags=a&tags=b` format, not `tags[]=a`)
- **Pages**: default-exported function components, each in own directory under `pages/`
- **Table pages**: server-side pagination, local filter state, explicit API calls on search (not useEffect-watching filters) — see `pages/admin/users.tsx` or `pages/records/index.tsx` as reference

### Data Storage

- **Database**: MySQL via Prisma — column mapping uses `@map("snake_case")`, tables use `@@map("plural")`
- **Avatar storage**: Base64 in `User.avatar` field (`@db.LongText`) — no file upload, stored inline
- **Problem content**: Markdown files on filesystem at `problems/{slug}/problem.md`
- **Testcases**: Filesystem at `problems/{slug}/testcases/{n}.in` and `{n}.out`
- **Problem score**: `Problem.score` field (Int, default 0), admin can customize; default by difficulty: EASY=1, MEDIUM=3, HARD=7
- **Total score**: User's total score = sum of `problem.score` for each problem's first AC only (`UserService.getPublicProfile`)
- **Problem import/export**: zip format — `{slug}/problem.json` + `{slug}/problem.md` + `{slug}/testcases/`, uses `adm-zip` library
- **Problem lists**: `problem_lists` + `problem_list_items` tables — 题单支持公共（isPublic=true, ADMIN/TEACHER 管理）和个人（isPublic=false, 用户自管），中间表带 `sort_order` 排序
- **Solutions**: `solutions` table — 题解内容存 `content`（LongText），关联 `problemId` + `authorId`，每人可对同一题写多篇题解；含 `status`（PENDING/APPROVED/REJECTED）和 `rejectReason` 审核字段
- **Announcements**: `announcements` table — 公告标题 `title`（VarChar 200）、摘要 `summary`（VarChar 500）、详情 `content`（LongText，Markdown）、`isPinned`（Boolean）、`status`（DRAFT/PUBLISHED）、关联 `authorId`；排序逻辑：置顶优先 + 时间倒序
- **Prisma version**: Pinned to v5 (v7 has breaking changes) — do NOT upgrade

### Key Enums

- `Role`: USER, ADMIN, TEACHER (no STUDENT — students are USER)
- `SubmissionStatus`: PENDING, JUDGING, AC, WA, TLE, MLE, RE, CE, SE
- `Difficulty`: EASY, MEDIUM, HARD
- `ContestMode`: ACM, OI (schema only, no API yet)

## Important Constraints

- **No public registration** — users created by admins only
- **Code visibility**: Regular users see only their own submission code; teachers and admins see all
- **Judge local mode** (Windows dev): No memory tracking, no sandbox — uses `spawnSync` with timeout. Uses `127.0.0.1` by default to avoid DNS issues.
- **Heatmap logic**: Only counts the **first time** a user ACs a problem (unique per user/problem). Backend uses a composite index for speed.
- **Tag statistics**: Incremented on first AC. Sync historical data using `server/scripts/backfill-tags.ts`.
- **Supported languages**: C, C++, Java, Python (hardcoded in judge and `CreateSubmissionDto`)
- **JWT expiry**: 7 days
- **No WebSocket yet** — judge results are polled; WebSocket is planned but not implemented
- **Contest models** exist in Prisma schema but have no server modules or endpoints
