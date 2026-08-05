# ETLOJ CLI

ETLOJ 的命令行题目查询工具，要求 Node.js 18 或更高版本。

## 开发运行

```powershell
cd cli
npm install
npm run build
node dist/index.js --help
```

也可以直接运行 TypeScript：

```powershell
npm run dev -- problem list
```

## 配置和登录

```powershell
node dist/index.js config set api-url http://localhost:3000/api
node dist/index.js auth login
node dist/index.js auth status
```

配置文件默认位于 Windows 的 `%APPDATA%/etloj/config.json`。也支持通过环境变量覆盖：

```powershell
$env:ETLOJ_API_URL = "http://localhost:3000/api"
$env:ETLOJ_TOKEN = "your-token"
```

## 查询题目

```powershell
node dist/index.js problem list
node dist/index.js problem search "最短路"
node dist/index.js problem list --difficulty GOLD --tag 图论 --tag-mode AND
node dist/index.js problem get P1001
node dist/index.js problem get P1001 --format json
node dist/index.js problem get P1001 --field stats.acceptanceRate
node dist/index.js problem markdown P1001
node dist/index.js problem status P1001
node dist/index.js problem passed P1001 --format json

# 按题面内容搜索
node dist/index.js problem search "复杂度" --in content

# 获取指定标签的题目
node dist/index.js problem list --tag 图论

# 显式获取全部结果；默认最多 1000 条，硬上限 5000 条
node dist/index.js problem list --all --limit 2000 --format ndjson
```

默认列表和详情只输出 slug、title、timeLimit、memoryLimit、score、tags、stats；详情同时包含 Markdown。使用 `--full` 可以查看完整详情元数据。普通列表默认只请求一页，每页最多 100 条；使用 `--all` 才会继续分页。

使用 `--format json` 或 `--format ndjson` 时，结果可以直接交给 PowerShell、`jq` 或其他脚本处理。

`problem status` / `problem passed` 查询当前登录账号的状态，返回 `AC`、`ATTEMPTED` 或 `NOT_ATTEMPTED`，需要先执行 `etloj auth login`。

## 公共题库和个人题库

`problem list` 查询公共题目池；`library` 查询公开的题库，包括用户创建的公开个人题库。这些命令不要求登录：

```powershell
node dist/index.js library list
node dist/index.js library search "入门"
node dist/index.js library get 6
```

`problem-list` 是 `library` 的别名。私有题库不属于匿名查询范围，当前 CLI 不会绕过权限访问。

## 测试

```powershell
npm test
npm run build
```

`npm test` 使用本地 HTTP 测试服务器验证请求头、查询参数和 JSON 响应，不要求启动 MySQL 或 ETLOJ 后端。要测试真实数据，需要先启动 `server`，再运行上面的查询命令。
