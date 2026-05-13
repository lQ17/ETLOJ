# 公告系统实现计划

## 概述

在 ETLOJ 平台中实现公告功能：后端 AnnouncementModule + 前端首页公告栏 + 后台公告管理。

## 实现步骤

### 1. 数据库层

**1.1 修改 Prisma Schema**
- 文件：`server/prisma/schema.prisma`
- 操作：
  1. User 模型添加 `announcements Announcement[]` 关联
  2. 新增 `Announcement` 模型（见设计文档）

### 2. 后端 - AnnouncementModule

**2.1 创建目录和文件**
- 目录：`server/src/announcement/`
- 文件列表：
  - `announcement.module.ts` — 模块定义
  - `announcement.service.ts` — 业务逻辑
  - `announcement.controller.ts` — 路由处理
  - `dto/create-announcement.dto.ts` — 创建 DTO
  - `dto/update-announcement.dto.ts` — 编辑 DTO

**2.2 DTO 定义**
- CreateAnnouncementDto:
  - title: string, @IsString(), @IsNotEmpty(), @MaxLength(200)
  - summary: string, @IsString(), @IsNotEmpty(), @MaxLength(500)
  - content: string, @IsString(), optional
  - isPinned: boolean, optional (default false)
  - status: string, optional (default "DRAFT")

- UpdateAnnouncementDto: 同上，全部 optional

**2.3 Service 方法**
- `findPublished(page, pageSize)`: 已发布公告列表，置顶优先 + 时间倒序
- `findOnePublic(id)`: 已发布公告详情
- `findAllForAdmin(status?, page, pageSize)`: 管理列表，含草稿
- `create(authorId, dto)`: 创建公告
- `update(id, dto)`: 编辑公告
- `remove(id)`: 删除公告

**2.4 Controller 路由**
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | /announcements | 公开 |
| GET | /announcements/:id | 公开 |
| GET | /announcements/admin/all | ADMIN |
| POST | /announcements | ADMIN |
| PATCH | /announcements/:id | ADMIN |
| DELETE | /announcements/:id | ADMIN |

**2.5 注册模块**
- 文件：`server/src/app.module.ts`
- 操作：import AnnouncementModule

### 3. 前端 - API 层

**3.1 新建文件**
- 文件：`client/src/api/announcement.ts`
- 导出 `announcementApi` 对象，包含：
  - `list(params: { page?, pageSize? })` → GET /announcements
  - `getById(id)` → GET /announcements/:id
  - `adminList(params: { status?, page?, pageSize? })` → GET /announcements/admin/all
  - `create(data)` → POST /announcements
  - `update(id, data)` → PATCH /announcements/:id
  - `remove(id)` → DELETE /announcements/:id

### 4. 前端 - 首页公告栏

**4.1 修改文件**
- 文件：`client/src/pages/home/index.tsx`
- 操作：
  1. 导入 `announcementApi` 和 `IconNotification`
  2. 导入 `Modal`, `ReactMarkdown`（从 react-markdown）
  3. 新增状态：`announcements: any[]`, `selectedAnnouncement: any`, `modalVisible: boolean`
  4. useEffect 中调用 `announcementApi.list({ pageSize: 5 })`
  5. 右侧特征卡区域替换为公告栏组件：
     - 标题 "公告栏" + IconNotification
     - 列表渲染 announcements：置顶标记 + 标题 + 日期 + 摘要
     - 点击行设置 selectedAnnouncement 并打开 modal
  6. 底部添加 Modal 显示 ReactMarkdown 渲染的完整内容

**4.2 样式**
- 保持与原特征卡一致的布局和间距
- 置顶公告添加 📌 图标
- 日期使用灰色小字显示在右侧

### 5. 前端 - 后台公告管理

**5.1 新建目录和文件**
- 目录：`client/src/pages/admin/announcements/`
- 主文件：`index.tsx`

**5.2 Admin 页面更新**
- 文件：`client/src/pages/admin/index.tsx`
- 操作：
  1. 导入 `AdminAnnouncementsPage` 组件
  2. 在 Tabs 中添加 `{isAdmin && (<Tabs.TabPane key="announcements" title="公告管理">...)}`

**5.3 公告管理页面结构**
参考 `admin/solutions/index.tsx` 的模式：

- 两种视图模式（Tabs 或 state 切换）：
  1. 管理公告（列表）
  2. 创建/编辑公告（表单）

- 列表视图：
  - 状态筛选 Select（DRAFT / PUBLISHED / 全部）
  - Table 列：ID、标题、状态 Tag、置顶 Switch、创建时间、操作（编辑/删除）
  - Switch 切换置顶：调用 `announcementApi.update(id, { isPinned })`
  - 删除确认 Popconfirm

- 表单视图：
  - 返回按钮
  - Input: 标题（必填，maxLength=200）
  - Input.TextArea: 摘要（必填，maxLength=500，autoSize={{ minRows: 2, maxRows: 4 }}）
  - Input.TextArea: 内容（autoSize={{ minRows: 8 }}）
  - Switch: 置顶
  - Radio Group: 状态（DRAFT / PUBLISHED）
  - 提交按钮：调用 create 或 update API

### 6. 数据库同步

**6.1 执行 Prisma Push**
```bash
cd server && npx prisma db push
```

## 文件清单

| 操作 | 文件路径 |
|------|----------|
| 修改 | server/prisma/schema.prisma |
| 新建 | server/src/announcement/announcement.module.ts |
| 新建 | server/src/announcement/announcement.service.ts |
| 新建 | server/src/announcement/announcement.controller.ts |
| 新建 | server/src/announcement/dto/create-announcement.dto.ts |
| 新建 | server/src/announcement/dto/update-announcement.dto.ts |
| 修改 | server/src/app.module.ts |
| 新建 | client/src/api/announcement.ts |
| 修改 | client/src/pages/home/index.tsx |
| 新建 | client/src/pages/admin/announcements/index.tsx |
| 修改 | client/src/pages/admin/index.tsx |

## 验证点

1. `npx prisma db push` 成功，announcements 表创建
2. POST /announcements 创建公告返回 201
3. GET /announcements 返回已发布公告列表（置顶优先）
4. GET /announcements/admin/all 返回全部公告（含草稿）
5. 首页显示最近 5 条公告，点击弹出详情 modal
6. Admin 页面"公告管理" Tab 仅 ADMIN 可见
7. 公告管理可创建、编辑、删除、切换置顶

## 依赖

- 后端：无新增依赖
- 前端：`react-markdown`（已存在于 solution 页面）