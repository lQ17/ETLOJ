# ETLOJ 管理员测试数据 MCP 功能实施规划

> 状态：待开发
> 编写日期：2026-08-21
> 目标版本：Remote MCP Phase 3
> 适用范围：`server/`、`client/`、Prisma schema、MCP/OAuth 测试与部署文档

## 1. 背景与目标

ETLOJ 当前提供匿名公开只读 MCP 和登录后的个人学习进度 MCP。管理员在网页 API 中已经能够读取、整批保存和删除题目测试数据，但这些能力尚未以安全的 MCP Tool 提供。

本阶段目标是在现有 `/mcp/private` 授权入口中增加一组仅 `ADMIN` 可见、可调用的测试数据管理工具，使管理员能够：

1. 按题目数据库 ID 或 slug 查询测试数据组数和测试点元数据；
2. 分块读取指定测试点的输入和标准输出；
3. 向题目末尾增加一组完整测试数据；
4. 删除指定测试点，并安全地将剩余测试点重新连续编号；
5. 对所有读取敏感内容和写入操作留下不包含测试数据正文的审计记录。

本阶段不是通用文件管理功能，不允许 MCP 客户端传入文件路径，也不允许执行命令、直接操作数据库或调用 Judge 内部接口。

## 2. 已确认的项目事实

- MCP 服务由 `McpModule` 提供，入口为 `/mcp` 和 `/mcp/private`。
- `/mcp/private` 使用 OAuth Bearer Token，并在每次验证 Token 时读取数据库中的最新用户状态和角色。
- 当前 MCP scope 为 `problems:read`、`submissions:read`。
- 题目测试数据位于 `{PROBLEMS_DIR}/{slug}/testcases/{n}.in` 和 `{n}.out`。
- 正式提交在 Server 创建任务时读取全部测试数据，并将内容快照写入 Redis 判题队列；已经成功入队的任务不会受后续测试数据修改影响。
- 官方生产环境当前为单 Server 实例，不使用多实例共享写入。
- 现有 REST API 对测试数据的读取和写入允许 `ADMIN`、`TEACHER`；本阶段 MCP 功能单独严格限制为 `ADMIN`。
- 公开 MCP 的 `get_problem` 当前已经返回 `testcaseCount`。本阶段不改变这一兼容行为；“仅管理员使用”特指隐藏测试内容和测试数据写操作。

## 3. 范围边界

### 3.1 本阶段包含

- 管理员测试数据 MCP Tools；
- 新增测试数据 OAuth scopes；
- Tool 可见性、scope 和角色三层控制；
- 测试数据文件集合校验、数值排序和安全错误；
- 单题目级并发控制；
- 写入暂存、目录交换和失败恢复；
- MCP 写操作幂等键与乐观并发校验；
- 管理操作持久化审计；
- OAuth 授权页权限说明；
- 单元测试、HTTP MCP 集成测试和生产验收步骤。

### 3.2 本阶段不包含

- 普通用户或教师访问隐藏测试数据；
- 创建、删除题目或修改题面；
- 修改已有测试点内容；需要修改时先删除再增加，或继续使用现有网页整批编辑功能；
- 测试数据 ZIP 导入导出 MCP Tool；
- 二进制测试数据；测试数据继续按 UTF-8 文本处理；
- 暴露服务器绝对路径、文件名之外的内部目录结构；
- Judge callback、提交结果篡改、Shell、SQL 或任意 HTTP 请求；
- 多 Server 实例下的分布式文件锁。本阶段保持单实例约束；未来横向扩容前必须升级为跨实例锁或独立数据服务。

## 4. 总体设计

```text
MCP Client
    |
    | OAuth access token
    v
/mcp/private
    |
    +-- Token 有效性、账号状态、实时角色
    +-- HTTP scope challenge
    +-- 按角色选择 MCP Server 工具集
    |
    v
Admin testcase tools
    |
    +-- Tool 内再次验证 ADMIN + scope
    +-- Zod 参数与大小限制
    +-- 幂等键 / revision 校验
    +-- 题目级读写锁
    +-- TestcaseStore 原子文件操作
    +-- AdminMcpAudit 持久化审计
```

管理员工具继续使用 `/mcp/private`，不新增 `/mcp/admin` Resource Server。这样能够复用当前 DCR、PKCE、Token 颁发、撤销和资源绑定流程，也不会影响匿名 `/mcp`。

## 5. 权限与 OAuth 设计

### 5.1 新增 scopes

```text
testcases:read   读取测试点元数据、输入和标准输出
testcases:write  增加或删除测试点
```

必须满足以下规则：

1. 未明确提供 `scope` 时，默认 scope 仍为现有的 `problems:read submissions:read`，不得默认授予测试数据权限；
2. 用户不是 `ADMIN` 时，请求任一 `testcases:*` scope 必须在授权阶段返回 `invalid_scope` 或等价安全错误；
3. Access Token 验证仍实时查询用户角色；管理员被降权、停用或取消审核后，旧 Token 立即失去管理员 Tool 调用能力；
4. `tools/call` 的 HTTP 层根据工具名要求对应 scope，以便返回标准 Bearer challenge；
5. 每个管理员 Tool 内必须再次校验 scope 和 `auth.extra.role === "ADMIN"`，HTTP 层不是最终安全边界；
6. `USER` 和 `TEACHER` 的 `tools/list` 不呈现管理员工具；`ADMIN` 使用管理员版私有 Server，可看到管理员工具；
7. 即使管理员 Token 未申请相应 scope，工具调用也必须失败，不得因为角色正确而绕过 scope。

### 5.2 工具集选择

在完成 `verifyBearerToken()` 并把认证信息写入请求后，根据实时角色选择：

```text
USER / TEACHER -> 当前 9 个私有工具
ADMIN          -> 当前 9 个私有工具 + 本阶段 4 个管理员工具
```

匿名 `/mcp` 始终保持当前 6 个公开工具，不加载任何管理员工具。

## 6. MCP Tool 契约

题目标识统一使用：

```ts
problem: string // 正整数形式表示数据库 ID，否则按 slug 解析
```

所有响应只返回白名单字段，不返回 `filePath`、绝对路径、Token、堆栈或其他内部字段。

### 6.1 `list_problem_testcases`

用途：查看题目测试数据集合状态、完整测试点数量和每组元数据。

权限：`ADMIN` + `testcases:read`

输入：

```ts
{
  problem: string;
}
```

成功输出：

```ts
{
  problem: { id: number; slug: string; title: string };
  testcaseCount: number;       // 完整 .in/.out 配对数量
  revision: string;            // 当前集合的 SHA-256 revision
  valid: boolean;
  anomalies: Array<{
    index: number;
    missing: "input" | "output";
  }>;
  items: Array<{
    index: number;
    inputBytes: number;
    outputBytes: number;
    inputSha256: string;
    outputSha256: string;
  }>;
}
```

规则：

- 文件按测试点数字编号排序，不使用字符串排序；
- 只接受严格匹配 `^[1-9]\\d*\\.(in|out)$` 的文件作为测试点；
- `.in`、`.out` 缺失时在 `anomalies` 中报告；
- `revision` 由有序编号、两个文件长度和内容哈希共同生成；
- 发现异常时允许查询，但所有写操作必须返回 `TESTCASE_SET_INVALID`，避免在不完整集合上自动改号。

### 6.2 `get_problem_testcase`

用途：分块读取指定测试点的输入和标准输出，兼容超过单次 MCP 响应容量的文本。

权限：`ADMIN` + `testcases:read`

输入：

```ts
{
  problem: string;
  index: number;               // >= 1
  inputOffset?: number;        // 默认 0，按 JS 字符串位置计
  outputOffset?: number;       // 默认 0
  maxCharsPerField?: number;   // 默认 32768，最大 65536
}
```

成功输出：

```ts
{
  problem: { id: number; slug: string; title: string };
  index: number;
  revision: string;
  input: {
    content: string;
    offset: number;
    nextOffset: number | null;
    totalChars: number;
    totalBytes: number;
    sha256: string;
    complete: boolean;
  };
  expectedOutput: {
    content: string;
    offset: number;
    nextOffset: number | null;
    totalChars: number;
    totalBytes: number;
    sha256: string;
    complete: boolean;
  };
}
```

读取内容属于敏感操作，必须写审计日志，但日志中只能记录字节数、哈希和读取区间，不能记录正文。

### 6.3 `add_problem_testcase`

用途：在当前完整测试点集合末尾追加一组测试数据。

权限：`ADMIN` + `testcases:write`

注解：

```ts
{
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
```

输入：

```ts
{
  problem: string;
  input: string;
  expectedOutput: string;
  expectedRevision: string;
  operationId: string;         // UUID，用于安全重试和去重
}
```

成功输出：

```ts
{
  problem: { id: number; slug: string };
  addedIndex: number;
  testcaseCount: number;
  previousRevision: string;
  revision: string;
  replayed: boolean;
}
```

规则：

- 新编号固定为当前最大连续编号加一，客户端不能指定目标文件名；
- `expectedRevision` 与当前集合不一致时返回 `REVISION_CONFLICT`；
- 同一管理员、同一 `operationId` 的重试返回首次成功结果，不重复追加；
- 默认且最多每个 input/output 为 30 MiB，使用 `MCP_TESTCASE_MAX_FILE_BYTES` 配置；
- 空字符串允许存在，因为部分题目的输入或标准输出可能为空；
- 不得在日志或异常中输出测试数据正文。

### 6.4 `delete_problem_testcase`

用途：删除指定测试点，并将后续测试点安全地重新编号为连续序列。

权限：`ADMIN` + `testcases:write`

注解：

```ts
{
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}
```

输入：

```ts
{
  problem: string;
  index: number;
  expectedRevision: string;
  operationId: string;
  confirm: true;
}
```

成功输出：

```ts
{
  problem: { id: number; slug: string };
  deletedIndex: number;
  testcaseCount: number;
  renumbered: Array<{ from: number; to: number }>;
  previousRevision: string;
  revision: string;
  replayed: boolean;
}
```

规则：

- `confirm` 必须严格为 `true`；
- `expectedRevision` 不一致时拒绝操作；
- 删除 `.in` 和 `.out` 必须作为同一文件集合变更提交；
- 任一步骤失败时恢复原测试数据目录；
- 删除最后一组后允许得到 0 组测试数据，但响应必须明确警告该题将无法提交判题；
- 幂等重试不得误删重排后的同编号测试点。

## 7. 文件一致性与并发方案

### 7.1 统一 TestcaseStore

新增专用 `TestcaseStoreService`，集中负责：

- slug 和路径安全；
- 扫描、配对、数值排序、大小和哈希计算；
- 分块读取；
- revision 计算；
- 追加、删除、重新编号；
- 暂存目录、原目录备份、目录交换和失败恢复；
- 题目级锁。

`ProblemService.getTestcases()`、现有 REST 测试数据接口以及 MCP 管理工具逐步改为调用该服务，避免多套文件规则。提交创建时对测试数据的读取也必须经过同一把题目级读锁。

### 7.2 写入流程

单次写操作按以下顺序执行：

1. 获取题目级写锁；
2. 重新扫描当前集合并验证完整性；
3. 校验 `expectedRevision`；
4. 在同一题目目录下创建随机暂存目录；
5. 把变更后的完整文件集合写入暂存目录；
6. 逐文件校验编号、字节数和哈希；
7. 将当前 `testcases` 重命名为备份目录；
8. 将暂存目录重命名为 `testcases`；
9. 成功后删除备份目录；
10. 记录审计结果并释放锁。

如果第 8 步失败，必须立即把备份目录恢复为 `testcases`。进程启动时应扫描并报告遗留的暂存或备份目录，不得静默覆盖。

读操作在同一进程中获取题目级读锁，确保不会看到交换过程。当前生产为单 Server 实例；如果未来增加实例，必须先引入 Redis 分布式锁，并确认所有实例共享同一题目存储。

### 7.3 与现有写入口的关系

现有 `saveTestcases()` 采用先删后写方式，不满足本阶段的原子性要求。开发时应把它重构为调用 `TestcaseStoreService.replaceAll()`，否则网页后台写入仍可能绕过 MCP 的并发和一致性保护。

ZIP 导入流程也会直接写测试数据。至少需要保证导入新题时不会与已存在题目的 MCP 写入冲突；未来若支持覆盖导入，也必须接入同一存储服务和锁。

## 8. 输入限制与资源保护

新增配置：

```text
MCP_TESTCASE_MAX_FILE_BYTES=31457280
MCP_TESTCASE_READ_CHUNK_CHARS=32768
MCP_TESTCASE_READ_MAX_CHARS=65536
MCP_TESTCASE_MAX_COUNT=1000
MCP_ADMIN_WRITE_RATE_LIMIT_MAX=10
MCP_ADMIN_WRITE_RATE_LIMIT_WINDOW_MS=60000
```

要求：

- Zod 在 Tool 入口限制字符串长度、编号、UUID 和分页参数；
- Service 使用 `Buffer.byteLength(value, "utf8")` 再次执行字节限制；
- 管理员写操作按 `actorUserId` 独立限流，不能只依赖当前按 IP 的普通 MCP 限流；
- 内容读取必须分块，不能一次返回 20 MiB 测试文件；
- 所有同步文件操作应评估是否会长时间阻塞事件循环；哈希和大文件读取优先使用异步 `fs/promises`；
- 不允许通过符号链接逃逸题目目录。扫描时应拒绝非普通文件和符号链接；
- 不接受客户端提供的路径、扩展名或任意编号文件名。

超过 MCP 单文件限制的大型测试数据继续通过受保护的现有 ZIP/网页工作流管理，不扩大 MCP 请求体上限。

## 9. 审计设计

建议新增 Prisma 模型 `McpAdminAuditLog`，使用数据库持久化而不是仅依赖应用日志。建议字段：

```text
id
actorUserId
actorUsernameSnapshot
clientId
requestId
operationId（写操作必填，与 actorUserId 组成唯一约束）
toolName
action
problemId
problemSlugSnapshot
testcaseIndex
beforeCount
afterCount
inputBytes
outputBytes
inputSha256
outputSha256
contentOffset
contentLength
success
errorCode
resultJson（只保存非敏感幂等结果）
createdAt
completedAt
```

约束：

- 不保存 input、expectedOutput 正文；
- 不保存 Bearer Token、refresh token、授权码或完整异常堆栈；
- 写操作先创建 `PENDING` 审计记录，再修改文件，完成后更新成功状态和可安全重放的结果；
- 如果无法创建审计记录，写操作不得执行；
- 如果文件已经修改但审计完成更新失败，必须输出高优先级服务日志并保留 PENDING 记录供人工核查；
- 读取测试正文也记录成功或失败，但不要求 `operationId`；
- 审计查询界面和审计 MCP Tool 不在本阶段范围内。

项目当前使用 `prisma db push` 而不是 migration。加入审计表时必须按生产规则先备份数据库，在本地生成 Prisma Client，生产只执行经过审查的 `db push --skip-generate`。

## 10. 安全错误模型

Tool 错误统一返回：

```ts
{
  isError: true,
  structuredContent: {
    error: {
      code: string;
      message: string;
    }
  },
  content: [{ type: "text", text: string }]
}
```

允许对客户端暴露的错误码：

```text
UNAUTHORIZED
ADMIN_REQUIRED
INSUFFICIENT_SCOPE
PROBLEM_NOT_FOUND
TESTCASE_NOT_FOUND
TESTCASE_SET_INVALID
REVISION_CONFLICT
OPERATION_ID_CONFLICT
PAYLOAD_TOO_LARGE
TESTCASE_LIMIT_EXCEEDED
RATE_LIMITED
INVALID_ARGUMENT
INTERNAL_ERROR
```

错误消息不得包含绝对路径、测试内容、数据库错误、Redis key、Token、堆栈或 Node.js 原始系统错误。详细异常只进入服务端日志，并同样需要清除敏感正文。

## 11. 代码改动规划

### 11.1 Server

```text
server/src/testcase/
├── testcase.module.ts
├── testcase-store.service.ts
├── testcase-store.service.spec.ts
├── testcase-lock.service.ts
└── testcase.types.ts

server/src/mcp/tools/
├── admin-testcase.tools.ts
└── admin-testcase.tools.spec.ts
```

修改：

- `server/src/mcp/mcp.service.ts`
  - 增加管理员工具注册模式；
  - 注入 `TestcaseStoreService` 和审计服务。
- `server/src/mcp/mcp.http.ts`
  - 验证后按角色选择普通/管理员私有 handler；
  - 增加工具到 scope 的映射；
  - 保留匿名入口不变。
- `server/src/mcp/auth/mcp-oauth.service.ts`
  - 扩展 scope；
  - 保持旧默认 scope；
  - 管理 scope 授权时校验 ADMIN。
- `server/src/problem/problem.service.ts`
  - 测试数据读取、保存、删除改为委托统一存储服务；
  - 保持现有 REST 响应兼容。
- `server/src/problem/problem.module.ts`
  - 导入并导出 TestcaseModule。
- `server/prisma/schema.prisma`
  - 增加 `McpAdminAuditLog` 及必要索引、唯一约束。
- `server/src/main.ts`
  - 不提高当前 50 MB body limit；MCP Tool 自身使用更严格限制。

### 11.2 Client

修改 OAuth 授权页面：

- 增加 `testcases:read`、`testcases:write` 的中文说明；
- 将“个人学习数据”文案调整为能覆盖管理员权限的表述；
- 对写权限使用明显的风险提示；
- 非管理员请求管理 scope 时显示后端返回的安全错误，不伪装成授权成功。

### 11.3 文档与配置

- 更新 `.env` 示例、Docker Compose 可选配置和 README MCP 工具列表；
- 更新当前 MCP 主规划的“明确排除”章节，将管理员测试数据 MCP 移入已实现范围；
- 更新生产部署和验收记录；
- 文档示例不得包含真实隐藏测试数据。

## 12. 开发阶段与任务拆分

### Phase A：存储层加固

- [ ] 建立 `TestcaseStoreService` 和题目级读写锁；
- [ ] 实现严格扫描、完整配对、数值排序和 revision；
- [ ] 实现分块读取；
- [ ] 实现原子 `replaceAll`、`append`、`deleteAndRenumber`；
- [ ] 把提交读取和现有 REST 写入口接入统一存储层；
- [ ] 覆盖失败恢复和并发测试。

完成条件：不接 MCP 时，现有网页测试数据管理和提交判题回归通过，且文件操作不会留下半套可见数据。

### Phase B：审计与幂等

- [ ] 增加 Prisma 审计模型；
- [ ] 实现 PENDING、SUCCESS、FAILED 生命周期；
- [ ] 实现 `operationId` 唯一约束和成功结果重放；
- [ ] 验证审计记录不含测试正文和凭证。

完成条件：重复写请求不会重复追加或误删；每次敏感读取和写入均可追溯。

### Phase C：OAuth 与 MCP Tools

- [ ] 增加两个 scope，并保持旧默认 scope；
- [ ] 在授权阶段拒绝非管理员申请管理 scope；
- [ ] 按实时角色选择 Tool 集；
- [ ] 注册四个管理员 Tool；
- [ ] HTTP 层和 Tool 层执行双重权限验证；
- [ ] 增加按管理员账号的写限流。

完成条件：普通用户和教师看不到管理员 Tool；管理员缺 scope 时不能调用；管理员具备 scope 时四个 Tool 均可工作。

### Phase D：前端、文档与生产准备

- [ ] 更新 OAuth 授权页；
- [ ] 更新 README、配置示例和 MCP 主规划；
- [ ] 完成本地构建、测试和标准 MCP Client 验收；
- [ ] 准备数据库备份、制品、回滚和生产验收清单。

## 13. 测试矩阵

### 13.1 存储层单元测试

- 空目录返回 0 组；
- `1、2、10` 按数值排序；
- 缺失 `.in` 或 `.out` 能被识别；
- 非法文件名和符号链接不被当作测试点；
- UTF-8 中文、多字节字符和空内容读取正确；
- 分块读取可以无损拼回完整内容；
- 追加得到正确的新编号；
- 删除首个、中间、末尾和唯一测试点；
- 删除后输入与输出始终配对并连续编号；
- revision 不符时不修改文件；
- 暂存写入失败、目录交换失败时原集合保持可用；
- 同题读写并发不会读取到半套数据；不同题目操作可以并行。

### 13.2 Tool 单元测试

- 无认证返回 `UNAUTHORIZED`；
- USER 和 TEACHER 返回 `ADMIN_REQUIRED`；
- ADMIN 缺少 scope 返回 `INSUFFICIENT_SCOPE`；
- 参数越界、非法 UUID、超大内容被拒绝；
- 找不到题目或测试点返回稳定错误码；
- 输出不包含路径和非白名单字段；
- 日志不包含测试正文；
- 删除 Tool annotations 正确；
- 相同 `operationId` 重试返回 `replayed: true`；
- 相同 `operationId` 携带不同参数返回 `OPERATION_ID_CONFLICT`。

### 13.3 MCP HTTP 集成测试

- 匿名 `/mcp` 仍只有当前 6 个工具；
- USER、TEACHER 的 `/mcp/private` 仍只有当前 9 个工具；
- ADMIN 的 `/mcp/private` 看到 13 个工具；
- 缺失、无效、过期、撤销 Token 仍返回标准 401；
- 管理 scope 不足返回带正确 scope 的 Bearer challenge；
- 非管理员无法通过伪造 Tool 参数或 userId 获得权限；
- 角色从 ADMIN 降为 TEACHER 后旧 Token 立即不能调用；
- 四个管理员 Tool 通过官方 MCP Client 完成真实调用链；
- 现有公开和个人 Tool 全部回归。

### 13.4 判题回归

- 修改测试数据前创建的任务使用原快照正常完成；
- 修改后创建的任务使用新快照；
- 连续两次正式提交正常；
- 正式提交和运行代码任务并发正常；
- `judge:queue:processing`、dead-letter 和回调机制不受影响。

## 14. 本地验收命令

实际脚本以 `package.json` 为准，至少执行：

```bash
cd server
npm test -- --runInBand src/testcase src/mcp src/problem src/submission
npm run build

cd ../client
npm run build

cd ../judge
npm test
npm run typecheck
npm run build
```

对本次新增和修改文件单独执行 ESLint。仓库全量存在既有 lint 问题时，应明确区分本次文件结果与全量结果，不得把局部通过描述为全量通过。

## 15. 验收标准

以下条件全部满足才可标记开发完成：

- [ ] 只有实时角色为 ADMIN 的账号能看到管理员 Tool；
- [ ] ADMIN 仍必须显式获得对应 OAuth scope；
- [ ] 能按 ID 和 slug 查看测试点数量与元数据；
- [ ] 能分块读取输入和标准输出并无损重组；
- [ ] 能幂等追加一组测试数据；
- [ ] 能幂等删除指定测试点并正确重新编号；
- [ ] 并发或故障不会向提交读取暴露半套文件；
- [ ] revision 冲突不会覆盖他人的新修改；
- [ ] 审计记录完整且不含正文、路径、Token 或密码；
- [ ] 普通用户、教师、匿名访问和 scope 不足场景全部被拒绝；
- [ ] 公开 MCP 6 个工具和个人 MCP 9 个工具无回归；
- [ ] 网页测试数据管理和正式判题无回归；
- [ ] Server、Client、Judge 构建和相关测试通过；
- [ ] 生产部署前已备份数据库和题目数据目录，并准备可验证回滚方案。

## 16. 生产部署与回滚重点

1. 本地完成 Prisma Client 生成、Server/Client/Judge 测试与构建；生产机不构建、不安装依赖；
2. 部署前备份 MariaDB、`/opt/etloj/data/problems`、Server 制品和前端；
3. 审查 schema 仅新增审计表和索引后，生产执行 `prisma db push --skip-generate`，禁止使用 `--accept-data-loss`；
4. 先部署 Server，再部署 OAuth 授权页；两者版本不一致期间不得对外宣告管理 scope 可用；
5. 使用专门测试题完成 list、get、add、delete、幂等重试和 revision 冲突验收；
6. 检查日志中不存在测试正文、Bearer Token、绝对路径和未处理异常；
7. 验收 Nginx、Server、Judge、go-judge、MariaDB、Redis 状态及正式提交；
8. 回滚代码时不得覆盖或删除题目数据目录；如果 schema 已增加审计表，代码回滚可以暂时保留该表，不执行破坏性降级；
9. 若写操作中出现 PENDING 审计或遗留暂存目录，先停止管理员写入，核对当前 revision 和备份目录，再人工决定恢复，不得自动清空。

## 17. 开发决策摘要

本阶段固定采用以下决策，开发过程中如需改变必须先更新本文档：

```text
入口：继续使用 /mcp/private
角色：仅 ADMIN，明确排除 TEACHER
授权：角色 + OAuth scope 双重验证
工具数：4 个
写语义：append 与 delete，不提供任意文件覆盖
并发保护：题目级读写锁 + expectedRevision
失败保护：暂存完整集合 + 目录交换 + 备份恢复
重试保护：必填 operationId + 持久化幂等结果
大内容读取：按字符分块
审计：数据库持久化，不保存正文
公开 testcaseCount：保持现状，避免兼容性变更
生产拓扑：本阶段仅承诺单 Server 实例
```
