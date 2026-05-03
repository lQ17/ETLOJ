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

### Backend Patterns (NestJS)

- **Modules**: AuthModule, UserModule, ProblemModule, SubmissionModule — each with controller, service, dto/
- **PrismaModule** is `@Global()` — inject `PrismaService` anywhere without importing
- **Auth**: JWT + Passport (`jwt.strategy.ts`), `JwtAuthGuard`, `RolesGuard` + `@Roles()` decorator, `@CurrentUser()` param decorator
- **Global validation**: `ValidationPipe` with `whitelist: true, transform: true`
- **Body limit**: `express.json({ limit: '5mb' })` configured in `main.ts` for Base64 avatar uploads
- **Problem routing**: All `:id` params accept both numeric ID and slug string — `parseIdOrSlug()` helper in controllers, `resolveProblem()` in service
- **Route priority**: In controllers with both `me/*` and `:id` routes, `me/*` MUST be defined before `:id` — NestJS matches top-to-bottom and `:id` captures "me" as a param
- **Profile module**: `ProfileController` (public, no auth guards) serves `GET /api/profile/:username` and `/api/profile/:username/stats`

### Frontend Patterns

- **State**: Zustand (`stores/auth.ts`) — user/token/login/logout; login fetches full profile (including avatar) immediately after token set
- **UI**: Arco Design (`@arco-design/web-react`) — never use other component libraries
- **Charts**: ECharts via `echarts-for-react` — used in profile page for heatmap, pie, radar
- **API layer**: `client/src/api/*.ts` — plain objects with async methods using shared Axios instance (auto-attaches JWT, unwraps response, 30s timeout)
- **Pages**: default-exported function components, each in own directory under `pages/`
- **Table pages**: server-side pagination, local filter state, explicit API calls on search (not useEffect-watching filters) — see `pages/admin/users.tsx` or `pages/records/index.tsx` as reference

### Data Storage

- **Database**: MySQL via Prisma — column mapping uses `@map("snake_case")`, tables use `@@map("plural")`
- **Avatar storage**: Base64 in `User.avatar` field (`@db.LongText`) — no file upload, stored inline
- **Problem content**: Markdown files on filesystem at `problems/{slug}/problem.md`
- **Testcases**: Filesystem at `problems/{slug}/testcases/{n}.in` and `{n}.out`
- **Prisma version**: Pinned to v5 (v7 has breaking changes) — do NOT upgrade

### Key Enums

- `Role`: USER, ADMIN, TEACHER (no STUDENT — students are USER)
- `SubmissionStatus`: PENDING, JUDGING, AC, WA, TLE, MLE, RE, CE, SE
- `Difficulty`: EASY, MEDIUM, HARD
- `ContestMode`: ACM, OI (schema only, no API yet)

## Important Constraints

- **No public registration** — users created by admins only
- **Code visibility**: Regular users see only their own submission code; teachers and admins see all
- **Judge local mode** (Windows dev): No memory tracking, no sandbox — uses `spawnSync` with timeout
- **Supported languages**: C, C++, Java, Python (hardcoded in judge and `CreateSubmissionDto`)
- **JWT expiry**: 7 days
- **No WebSocket yet** — judge results are polled; WebSocket is planned but not implemented
- **Contest models** exist in Prisma schema but have no server modules or endpoints
