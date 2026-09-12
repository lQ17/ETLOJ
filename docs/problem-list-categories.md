# 题单分类与编排

## 使用入口

前台入口为 `/lists`，保留“公共题单”和“我的题单”。公共题单采用“一级栏目 → 二级分类 → 题单”的导航结构。“全部题单”包含未归类的公共题单。

后台入口为 `/admin` → “题单管理” → “分类与编排”。分类为空时，管理员可以点击“一键建立建议分类”，生成以下初始目录，再按实际课程调整：

| 一级栏目 | 初始二级分类 |
| --- | --- |
| 系统学习 | 编程入门、基础算法、进阶算法、数据结构 |
| 竞赛考级 | GESP、CSP-J、CSP-S、NOIP |
| 教材配套 | 由管理员按实际教材添加 |
| 专题训练 | 基础巩固、综合训练、易错题精选 |

初始化不会自动归类旧题单，也不会复制题目；已有分类时不允许重复初始化。

## 编排规则

- 一级栏目只组织二级分类；题单放入二级分类，最多两层。
- 同一份公共题单可以放入多个二级分类。各入口引用原题单，题目内容和个人通过进度共享。
- 栏目、分类使用排序值控制顺序，值越小越靠前；相同值按分类 ID 排序。
- 二级分类中的题单使用“上移／下移”调整，操作成功即保存；不同分类中的顺序互不影响。
- 一级栏目的“栏目全部”汇总启用的二级分类并去重，按创建时间排序。“全部题单”也按创建时间排序。
- “批量添加题单”支持标题搜索、跨页勾选和“仅看未分类”。未分类指没有任何分类关联；已经关联停用分类的题单不属于未分类。
- 管理端筛选参数 `uncategorized=true` 不能与 `categoryId` 同时使用；二者含义冲突时接口返回 400，避免把空结果误认为没有题单。
- 重复添加不会重复收录或修改已有顺序。批量包含不存在或非公共题单时，整批拒绝，避免部分成功。
- “移出”只删除当前分类关联，原题单及其他分类中的关联保留。
- 停用一级栏目会隐藏其下全部分类；停用二级分类会隐藏该分类。停用不删除题单，公共题单仍可从“全部题单”访问。
- 分类不改变题单和题目的访问权限。普通用户的题目列表、题目总数及 AC 数排除隐藏题，教师和管理员保持现有隐藏题管理权限。

## 权限

| 操作 | 普通用户／访客 | 教师 | 管理员 |
| --- | --- | --- | --- |
| 浏览启用分类与公共题单 | 可以 | 可以 | 可以 |
| 查看后台分类目录和关联 | 不可以 | 可以 | 可以 |
| 批量归类、移出、编排题单 | 不可以 | 可以 | 可以 |
| 建立建议分类、创建和编辑分类、启停分类 | 不可以 | 不可以 | 可以 |

个人题单继续通过“我的题单”维护，不参与公共分类目录。

## 浏览状态

公共题单页面使用 URL 参数保存筛选状态：

```text
/lists?category=5&q=循环&page=2
/lists?tab=mine&myPage=2
```

`category` 为一级或二级分类 ID，`q` 为公共题单搜索词，`page` 为公共分页，`myPage` 为个人分页。切换分类或提交搜索时重置公共分页；两个页签各自保留页码。详情页链接携带来源地址，点击详情页的“题单”面包屑可恢复分类、搜索词和页码。来源仅接受站内 `/lists` 页面。

## 数据结构与接口

新增 `problem_list_categories` 和 `problem_list_category_items`。关联表以 `(category_id, list_id)` 为联合主键，保存分类内排序，并索引分类顺序及题单 ID。原有 `problem_lists`、`problem_list_items` 和提交数据保持不变。

| 接口 | 用途 |
| --- | --- |
| `GET /api/problem-list-categories` | 公共分类树 |
| `GET /api/problem-list-categories/manage` | 包含停用项的管理目录 |
| `POST /api/problem-list-categories/initialize` | 空分类目录初始化 |
| `POST /api/problem-list-categories` | 创建一级或二级分类 |
| `PATCH /api/problem-list-categories/:id` | 修改名称、说明、排序、启用状态 |
| `GET /api/problem-list-categories/:id/items` | 分类内题单及顺序 |
| `POST /api/problem-list-categories/:id/items` | 批量添加，正文 `{ "listIds": [1, 2] }` |
| `PATCH /api/problem-list-categories/:id/items/sort` | 保存完整顺序，正文 `{ "listIds": [2, 1] }` |
| `DELETE /api/problem-list-categories/:id/items/:listId` | 从该分类移出题单 |

现有 `GET /api/problem-lists` 增加 `categoryId` 和管理端 `uncategorized=true` 筛选。二级分类查询按关联顺序分页；一级栏目查询使用关系过滤去重。分类排序提交必须包含该分类当前的完整题单集合，集合变化时拒绝保存并提示刷新。

分类更新时名称、排序值和启用状态不能为空；说明字段允许提交 `null` 清空。

## 数据库准备

项目继续使用 Prisma 5。先在目标环境审查 schema 差异；生产环境按 `CLAUDE.md` 执行备份及部署流程。本次开发不包含生产部署。

若数据库与上一版 schema 一致，可以按项目现有流程同步 schema。仓库同时提供 `server/prisma/problem-list-categories.sql`，仅创建本功能的两张表、索引和外键，供数据库存在其他历史 schema 差异时进行针对性审查与应用。该 SQL 只能在两张表尚不存在时执行，不应在已经同步过 schema 的数据库重复执行。

本地生成匹配的 Prisma Client：

```powershell
cd server
npx prisma generate
```

数据库只增加分类表，不强制给旧题单分配分类。完成后在后台初始化或自行建立目录，通过“仅看未分类”逐步整理旧题单。

## 验证入口

```powershell
cd server
npm test -- --runInBand category problem-list.service.spec.ts
npm run build
```

数据库集成测试只允许本地地址，并在事务中回滚全部测试数据，需显式开启：

```powershell
$env:RUN_CATEGORY_DB_TESTS = '1'
npm test -- --runInBand category.integration.spec.ts
Remove-Item Env:RUN_CATEGORY_DB_TESTS
```

前端生产构建：

```powershell
cd client
npm run build
```

交互验收应覆盖初始化目录、跨页批量勾选、重复添加、调整顺序、分类切换、搜索和分页、从详情返回，以及停用分类后的访问行为。
