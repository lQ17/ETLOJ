# ETLOJ - Easy To Learn Online Judge

> 让 OI 学习更简单

## 简介

ETLOJ 是一个面向学校与社团的在线算法评测平台，致力于通过更友好的交互体验降低 OI（Olympiad in Informatics）的学习门槛。

**核心理念：** 学习算法不应该被工具劝退。ETLOJ 提供清晰的题目展示、即时的判题反馈、以及即将到来的 AI 辅助学习功能，让每一次提交都成为进步的阶梯。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Arco Design + Monaco Editor + KaTeX |
| 后端 | NestJS + TypeScript + Prisma 5 + MySQL 8 + Redis 7 |
| 判题 | go-judge 沙箱 + 独立 Node.js 判题服务 |
| 部署 | Docker Compose + Nginx |

## 功能特性

### 已实现

- **题目系统** — Markdown 题面 + LaTeX 公式支持，管理员可在线创建和管理题目
- **在线判题** — 支持 C / C++ / Java / Python，基于 go-judge 安全沙箱执行
- **用户系统** — JWT 认证，角色权限控制（管理员 / 教师 / 用户）
- **代码编辑器** — Monaco Editor（VS Code 内核），语法高亮与自动补全

### 规划中

- **AI 助手** — 辅助解题与学习，提供思路引导而非直接给出答案
- **技能树** — 可视化知识点掌握进度，点亮你的算法技能图谱
- **算法可视化** — 动态演示排序、搜索、图论等算法的执行过程
- **比赛系统** — ACM / OI 双模式，实时排行榜
- **讨论区** — 题目交流与公告系统

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL 8.x
- Redis 7.x
- go-judge（可选，判题需要）

### 安装

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/etloj.git
cd etloj

# 后端
cd server
npm install
cp .env.example .env    # 配置数据库连接
npx prisma db push       # 同步数据库
npm run seed             # 创建初始管理员 (admin / admin123)
npm run start:dev

# 前端
cd ../client
npm install
npm run dev

# 判题服务（可选）
cd ../judge
npm install
npm run start
```

### 访问

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api
- 初始管理员：`admin` / `admin123`

## 项目结构

```
etloj/
├── client/          # React 前端
├── server/          # NestJS 后端
├── judge/           # 判题服务
├── problems/        # 题目 Markdown 文件
├── docker-compose.yml
└── PROGRESS.md      # 开发进度
```

## License

Private - All rights reserved.
