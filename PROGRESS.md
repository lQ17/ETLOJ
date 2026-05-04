# ETLOJ 开发进度

## 已完成

### 基础设施
- [x] 项目架构搭建（前后端分离 Monorepo）
- [x] Docker Compose 配置（MySQL 8 + Redis 7 + go-judge）
- [x] Prisma Schema 设计（User/Problem/Submission/Contest 四表）
- [x] UI: Arco Design (`@arco-design/web-react`)
- [x] Charts: ECharts via `echarts-for-react` (含 WordCloud 插件)
- [x] API Layer: Axios 封装（自动 JWT、统一响应处理、30s 超时）

### 用户系统
- [x] JWT 登录认证
- [x] 管理员创建用户（注册不对外开放）
- [x] 角色权限控制（ADMIN / TEACHER / USER）
- [x] 前端登录页 + Header 动态显示
- [x] 多方式登录（用户名 / 邮箱 / 手机号）
- [x] 用户手机号字段（可选）
- [x] 邮箱改为可选字段
- [x] 默认密码机制（.env 配置 DEFAULT_USER_PASSWORD，默认 123456）
- [x] 停用/启用用户（isActive 字段，停用后无法登录）
- [x] 用户管理页二级导航（创建用户 / 管理用户）
- [x] 管理用户页面（分页列表、搜索、筛选、编辑、停用/启用、删除）
- [x] 退出登录自动跳转首页

### 题目管理
- [x] 题目 CRUD API（元数据存数据库，题面存 Markdown 文件）
- [x] 题目列表页（分页、难度筛选、关键词搜索、通过率统计）
- [x] 题目详情页（LaTeX 渲染、样例横排展示、一键复制）
- [x] 管理员题目管理页（Markdown 编辑器创建题目）
- [x] 测试数据管理（.in / .out 文件存储）
- [x] 题目详情页 Markdown 渲染深度优化（兼容 Windows CRLF，完美剥离原生样例区）

### 提交判题
- [x] 代码提交 API + Redis 队列分发
- [x] 判题服务（go-judge 沙箱执行，支持 C/C++/Java/Python）
- [x] 判题服务本地模式（JUDGE_MODE=local，无需 go-judge，Windows 开发环境用）
- [x] 判题结果 HTTP 回调
- [x] 前端代码编辑器（Monaco Editor，白色主题，16px 字号）
- [x] 判题状态轮询显示
- [x] 评分机制（满分100分，按测试点通过率计算；判题改为运行全部测试点而非短路）
- [x] 判题结果展示分数
- [x] **新增自测运行功能**（后端独立队列跑单例，前端支持自测输入/期望输出/实际输出展示，支持大屏模态框展开）

### 评测记录
- [x] 一级导航"评测记录"页
- [x] 按时间倒序分页展示所有评测记录（默认20条/页）
- [x] 筛选条件：用户名、题号、题目标题、评测状态
- [x] 一键重置筛选条件
- [x] 每条记录显示：用户名、评测状态+分数、题号+题目（可点击跳转）、评测时间、运行时间、内存、代码大小、语言
- [x] 查看代码功能（Monaco Editor 只读弹窗）
- [x] 代码权限控制：普通用户只能查看自己的代码，教师和管理员可查看所有人的代码
- [x] 题目路由支持 slug（如 /problems/P1012，同时兼容数字 ID）

### 示例数据
- [x] P1012 [NOIP 1998 提高组] 拼数（含 2 组测试数据）

### 个人中心 — 设置中心（阶段 A ✅）
- [x] 个人资料管理（头像 Base64 上传与预览、昵称、个性签名、邮箱、手机号）
- [x] 账号安全中心（bcrypt 旧密码校验 + 新密码修改）
- [x] 后端 `PATCH /api/users/me/profile` 和 `me/security` 接口
- [x] `GET /api/auth/profile` 返回数据库最新用户记录（含 avatar）
- [x] 登录后自动获取完整 profile（含头像），无需刷新页面
- [x] User 表 avatar 字段升级为 LongText，body 限制 5MB
- [x] NestJS 路由优先级修复（me/* 路由置于 :id 路由之前）
- [x] AppHeader 下拉菜单入口（个人主页 + 个人设置）

### 个人中心 — 个人主页数据大屏（阶段 B ✅）
- [x] 公开 Profile API（`GET /api/profile/:username` + `/stats`，无需登录）
- [x] 用户信息卡片（头像、用户名、签名、注册时间、已解题数、总提交数）
- [x] 提交统计饼图优化（Arco 配色、无描边、稳定中心总数显示、修复悬浮 Bug）
- [x] GitHub 风格活跃度热力图重构（仅统计每日**初次通过**、增加最近半年/一月/一周统计面板）
- [x] 热力图性能优化（后端增加 `(userId, status, problemId, createdAt)` 复合索引，查询耗时降至毫秒级）
- [x] 能力词云（替代雷达图，展示通过题目的算法标签分布）
- [x] 标签统计系统（新增 `UserTagRecord` 表，判题回调时自动增量更新标签统计）
- [x] 标签数据回刷脚本（`scripts/backfill-tags.ts`，用于同步历史 AC 记录的标签）
- [x] 响应式布局优化（卡片等高对齐、ECharts 零维度渲染修复、SaaS 风格配色词云）
- [x] 修复时区偏移导致的日期统计偏差（Date 构造逻辑重构）

## 待开发

### 核心功能
- [ ] 排名系统（ACM/OI 模式）
- [ ] 比赛系统（创建比赛、实时排名）
- [ ] 讨论区（题目讨论、公告）

### AI 功能
- [ ] AI 助手辅助解题
- [ ] AI 代码审查与提示

### 可视化
- [ ] 算法可视化演示（排序、搜索、图论等）
- [ ] 技能树系统（知识点点亮）

### 工程优化
- [ ] WebSocket 实时推送判题结果（替代轮询）
- [ ] 前端 Error Boundary
- [ ] Docker 部署方案
- [ ] CI/CD 流水线
