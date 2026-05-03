# ETLOJ 开发进度

## 已完成

### 基础设施
- [x] 项目架构搭建（前后端分离 Monorepo）
- [x] Docker Compose 配置（MySQL 8 + Redis 7 + go-judge）
- [x] Prisma Schema 设计（User/Problem/Submission/Contest 四表）

### 用户系统
- [x] JWT 登录认证
- [x] 管理员创建用户（注册不对外开放）
- [x] 角色权限控制（ADMIN / TEACHER / USER）
- [x] 前端登录页 + Header 动态显示

### 题目管理
- [x] 题目 CRUD API（元数据存数据库，题面存 Markdown 文件）
- [x] 题目列表页（分页、难度筛选、关键词搜索、通过率统计）
- [x] 题目详情页（LaTeX 渲染、样例横排展示、一键复制）
- [x] 管理员题目管理页（Markdown 编辑器创建题目）
- [x] 测试数据管理（.in / .out 文件存储）

### 提交判题
- [x] 代码提交 API + Redis 队列分发
- [x] 判题服务（go-judge 沙箱执行，支持 C/C++/Java/Python）
- [x] 判题结果 HTTP 回调
- [x] 前端代码编辑器（Monaco Editor，白色主题，16px 字号）
- [x] 判题状态轮询显示

### 示例数据
- [x] P1012 [NOIP 1998 提高组] 拼数（含 2 组测试数据）

## 待开发

### 核心功能
- [ ] 用户提交历史页面
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
