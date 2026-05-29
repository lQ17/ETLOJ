# ETLOJ 开发进度

## 已完成

### 基础设施
- [x] 前后端分离架构（NestJS + React + Vite）、Docker Compose、Prisma Schema
- [x] Arco Design + ECharts + Axios 封装（JWT、统一响应、30s 超时）

### 用户系统
- [x] JWT 认证、角色权限（ADMIN/TEACHER/USER）、多方式登录
- [x] 用户管理（分页/搜索/筛选/编辑/删除/批量创建/停用启用）

### 题目管理
- [x] 题目 CRUD（元数据 DB + Markdown 文件）、列表/详情页、测试数据管理
- [x] 分数系统（按难度默认分，仅首次 AC 计分）、批量导入导出（zip）
- [x] 标签系统（Tag + ProblemTag 多对多，AND/OR 筛选）
- [x] 路由支持 slug + 数字 ID、标题自动关联、导入格式说明

### 提交判题
- [x] 代码提交 + Redis 队列 + go-judge 沙箱，本地模式支持
- [x] 自测运行、滑动窗口限流、批量查询做题状态
- [x] Monaco Editor（空模板、禁用补全、设置齿轮持久化）

### 评测记录 & 排名
- [x] 评测记录页（分页/筛选/查看代码，权限控制）
- [x] 排名 API + 页面（Top10 柱状图、时间范围选择）

### 题单系统
- [x] 题单 CRUD（公共/个人、排序、slug 操作、OptionalJwtGuard）
- [x] 题单主页/详情页（卡片布局、搜索分页、做题状态）

### 个人中心
- [x] 资料管理（Base64 头像、昵称、签名、邮箱、手机号、密码修改）
- [x] 个人主页（信息卡片、提交饼图、热力图、标签统计、词云）

### 题解系统
- [x] 题解 CRUD + 审核系统（PENDING/APPROVED/REJECTED）
- [x] 题目详情页 Tab（题解列表/Markdown 渲染/Modal 编辑/深链接）
- [x] 个人主页题解区块、后台审核管理

### 公告系统
- [x] 公告 CRUD + 置顶/草稿状态、首页公告栏、列表页、后台管理

### AI 助手
- [x] AI 解题（SGLang GLM-5 + SSE 流式、上下文感知、代码编辑器语言关联）
- [x] ChatPanel + Vercel AI SDK、VS Code 风格代码高亮、低难度代码禁用复制
- [x] Token 限流（Redis）、会话持久化、管理员使用报告、首页实时统计卡片

### 算法可视化
- [x] `/visualization` 页面、step-based 引擎（generator 产出步骤快照）
- [x] 5 个排序算法（冒泡/选择/插入/归并/快速）、注册机制
- [x] BarChart 动画 + 播放控制栏 + 可编辑输入 + 算法分类 Tab
- [x] 算法可视化：交换动画视觉效果（二柱位置互换）

### UI/UX & 工程
- [x] 未登录提示卡片、蓝色链接、卡片/输入框配色、题面宽度调整
- [x] WebSocket 实时推送、Docker 全容器化部署
- [x] 前端路由守卫（AuthGuard / AdminGuard）

### 示例数据
- [x] P1012 [NOIP 1998 提高组] 拼数

## 待开发

- [ ] 比赛系统（创建比赛、实时排名）
- [ ] 讨论区（题目讨论）
- [ ] 技能树系统（知识点点亮）
- [ ] AI 代码高亮 diff 标注
- [ ] CI/CD 流水线
