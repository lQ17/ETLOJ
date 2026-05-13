# 公告系统设计文档

## 概述

在 ETLOJ 平台中新增公告功能，用于发布平台通知、更新日志等信息。首页"智能评测"特征卡替换为公告栏，后台 ADMIN 可管理公告。

## 数据模型

新增 `Announcement` 模型：

```prisma
model Announcement {
  id        Int      @id @default(autoincrement())
  title     String   @db.VarChar(200)
  summary   String   @db.VarChar(500)
  content   String   @db.LongText
  isPinned  Boolean  @default(false)
  status    String   @default("DRAFT") @db.VarChar(20)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("announcements")
}
```

- `status`: "DRAFT"（草稿）/ "PUBLISHED"（已发布）
- `isPinned`: 置顶公告在列表中优先显示
- `content`: Markdown 格式的详情内容
- User 模型增加 `announcements` 关联

## 后端 API

### 模块结构

新增 `AnnouncementModule`，包含：
- `announcement.controller.ts` — 路由处理
- `announcement.service.ts` — 业务逻辑
- `announcement.module.ts` — 模块定义
- `dto/create-announcement.dto.ts` — 创建 DTO
- `dto/update-announcement.dto.ts` — 编辑 DTO

### 接口定义

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /announcements | 已发布公告列表（置顶优先，按时间倒序） | 公开 |
| GET | /announcements/:id | 公告详情（仅已发布） | 公开 |
| GET | /announcements/admin/all | 全部公告（含草稿，分页） | ADMIN |
| POST | /announcements | 创建公告 | ADMIN |
| PATCH | /announcements/:id | 编辑公告 | ADMIN |
| DELETE | /announcements/:id | 删除公告 | ADMIN |

### 查询参数

- `GET /announcements`: `page`, `pageSize`（默认返回最近 10 条，首页展示用）
- `GET /announcements/admin/all`: `page`, `pageSize`, `status`（可选筛选）

### 排序逻辑

1. `isPinned = true` 排在前面
2. 同优先级按 `createdAt` 倒序

## 前端

### 首页改造

**文件**: `client/src/pages/home/index.tsx`

右侧特征卡（智能评测/AI题解/学习社区）替换为公告栏组件：

- 标题区域："公告栏" + 喇叭图标（IconNotification）
- 列表：展示最近 5 条已发布公告
  - 置顶公告带 📌 标记
  - 显示标题 + 日期（右侧灰色小字）
  - 显示摘要（单行截断）
- 底部无更多链接（公告数量有限，暂不需要）
- 点击公告行弹出 Modal，Markdown 渲染完整内容

### 后台管理

**Admin 页面** (`client/src/pages/admin/index.tsx`) 新增 Tab "公告管理"（ADMIN 可见）：

**子页面结构** (`client/src/pages/admin/announcements/index.tsx`)：

1. **管理公告** — 表格列表
   - 列：标题、状态（Tag）、置顶（Switch）、创建时间、操作（编辑/删除）
   - 支持状态筛选
   - 删除需确认弹窗

2. **创建/编辑公告** — 表单
   - 标题（Input, 必填, 最长 200 字）
   - 摘要（TextArea, 必填, 最长 500 字）
   - 内容（Input.TextArea，与题解编辑一致）
   - 置顶（Switch）
   - 状态（Radio: 草稿/已发布）
   - 提交按钮

### API 层

新增 `client/src/api/announcement.ts`，包含：
- `getList()` — 公开列表
- `getById(id)` — 公开详情
- `getAdminList(params)` — 管理列表
- `create(data)` — 创建
- `update(id, data)` — 编辑
- `remove(id)` — 删除

## 错误处理

- 非 ADMIN 用户访问管理接口返回 403
- 不存在的公告返回 404
- 未发布公告对普通用户不可见
- 表单验证：标题和摘要必填，内容可选（草稿可以无内容）

## 依赖

- 无需新增第三方库（Markdown 渲染复用项目已有的 `react-markdown`，编辑使用 Arco Design `Input.TextArea`）
- Prisma schema 变更后需运行 `npx prisma db push`
