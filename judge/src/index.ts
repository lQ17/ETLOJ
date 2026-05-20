import { createClient } from "redis";
import { spawnSync, execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const GO_JUDGE_URL = process.env.GO_JUDGE_URL ?? "http://127.0.0.1:5050";
const SERVER_URL = process.env.SERVER_URL ?? "http://127.0.0.1:3000";
const JUDGE_SECRET = process.env.JUDGE_SECRET ?? (() => { throw new Error("JUDGE_SECRET environment variable is required"); })();
const JUDGE_MODE = process.env.JUDGE_MODE ?? "local"; // "local" | "go-judge"
const QUEUE_KEY = "judge:queue";
const RUN_QUEUE_KEY = "judge:run";

type JudgeTask = {
  submissionId: number;
  problemId: number;
  code: string;
  language: string;
  timeLimit: number;
  memoryLimit: number;
  testcases: { input: string; expectedOutput: string }[];
};

type RunTask = {
  runId: string;
  code: string;
  language: string;
  input: string;
  timeLimit: number;
  memoryLimit: number;
};

// ============================================================
//  输入校验 & 输出消毒
// ============================================================

const SUPPORTED_LANGUAGES = ["c", "cpp", "java", "python"];
const MAX_CODE_LENGTH = 50000;
const MAX_RUN_INPUT_LENGTH = 10000;

/** 过滤 ANSI 转义序列和控制字符，防止终端注入 */
function sanitizeStderr(output: string): string {
  // 移除 ANSI 转义序列
  // 移除控制字符（保留换行 \n 和制表 \t）
  return output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** 校验判题任务输入，返回错误信息或 null */
function validateJudgeTask(task: JudgeTask): string | null {
  if (task.code.length > MAX_CODE_LENGTH) {
    return `代码长度超过限制（最大 ${MAX_CODE_LENGTH} 字符）`;
  }
  if (!SUPPORTED_LANGUAGES.includes(task.language)) {
    return `不支持的语言: ${task.language}`;
  }
  return null;
}

/** 校验自测运行任务输入，返回错误信息或 null */
function validateRunTask(task: RunTask): string | null {
  if (task.code.length > MAX_CODE_LENGTH) {
    return `代码长度超过限制（最大 ${MAX_CODE_LENGTH} 字符）`;
  }
  if (!SUPPORTED_LANGUAGES.includes(task.language)) {
    return `不支持的语言: ${task.language}`;
  }
  if (task.input.length > MAX_RUN_INPUT_LENGTH) {
    return `输入长度超过限制（最大 ${MAX_RUN_INPUT_LENGTH} 字符）`;
  }
  return null;
}

type RunResult = {
  status: string;
  stdout: string;
  stderr: string;
  timeUsed: number;
};

type JudgeResult = {
  submissionId: number;
  status: string;
  timeUsed: number;
  memoryUsed: number;
  score: number;
};

// ============================================================
//  go-judge 模式（线上部署）
// ============================================================

async function goJudgeRun(params: {
  cmd: string[];
  copyIn?: Record<string, { content: string } | { file: string }>;
  stdin?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  procLimit?: number;
  copyOut?: string[];
  copyOutCached?: string[];
}) {
  const res = await fetch(`${GO_JUDGE_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: [
        {
          args: params.cmd,
          env: ["PATH=/usr/bin:/bin", "HOME=/tmp"],
          files: [
            params.stdin !== undefined ? { content: params.stdin } : { src: "/dev/null" },
            { name: "stdout", max: 10240 },
            { name: "stderr", max: 10240 },
          ],
          cpuLimit: params.cpuLimit ?? 10_000_000_000,
          memoryLimit: params.memoryLimit ?? 512 * 1024 * 1024,
          procLimit: params.procLimit ?? 256,
          ...(params.copyIn ? { copyIn: params.copyIn } : {}),
          ...(params.copyOut ? { copyOut: params.copyOut } : {}),
          ...(params.copyOutCached ? { copyOutCached: params.copyOutCached } : {}),
        },
      ],
    }),
  });
  return (await res.json()) as any[];
}

async function goJudgeCompile(code: string, lang: string): Promise<{ ok: boolean; binary?: string; error?: string }> {
  let cmd: string[];
  let srcName: string;
  let binName: string;

  switch (lang) {
    case "c":
      srcName = "main.c";
      binName = "main";
      cmd = ["gcc", "main.c", "-o", "main", "-O2"];
      break;
    case "cpp":
      srcName = "main.cpp";
      binName = "main";
      cmd = ["g++", "main.cpp", "-o", "main", "-O2", "-std=c++17"];
      break;
    case "java":
      srcName = "Main.java";
      binName = "Main.class";
      cmd = ["javac", "Main.java"];
      break;
    case "python":
      return { ok: true };
    default:
      return { ok: false, error: "Unsupported language" };
  }

  const result = await goJudgeRun({
    cmd,
    copyIn: { [srcName]: { content: code } },
    cpuLimit: 15_000_000_000,
    memoryLimit: 512 * 1024 * 1024,
    copyOutCached: [binName],
  });

  const exitCode = result[0]?.exitStatus;
  if (exitCode !== 0) {
    const stderr = sanitizeStderr(result[0]?.files?.stderr ?? "");
    return { ok: false, error: stderr };
  }

  return { ok: true, binary: result[0]?.fileIds?.[binName] };
}

async function goJudgeRunOneTest(
  lang: string,
  binaryId: string | undefined,
  code: string,
  input: string,
  timeLimit: number,
  memoryLimit: number,
) {
  let cmd: string[];
  let copyIn: Record<string, any>;

  switch (lang) {
    case "c":
    case "cpp":
      cmd = ["./main"];
      copyIn = { main: { fileId: binaryId! } };
      break;
    case "java":
      cmd = ["java", "Main"];
      copyIn = { "Main.class": { fileId: binaryId! } };
      break;
    case "python":
      cmd = ["python3", "main.py"];
      copyIn = { "main.py": { content: code } };
      break;
    default:
      return { status: "CE" as const, time: 0, memory: 0 };
  }

  const result = await goJudgeRun({
    cmd,
    copyIn,
    stdin: input,
    cpuLimit: timeLimit * 1_000_000,
    memoryLimit: memoryLimit * 1024 * 1024,
  });

  return {
    status: result[0]?.status as string,
    exitCode: result[0]?.exitStatus as number,
    time: result[0]?.time ?? 0,
    memory: result[0]?.memory ?? 0,
    stdout: (result[0]?.files?.stdout ?? "") as string,
    stderr: sanitizeStderr(result[0]?.files?.stderr ?? ""),
  };
}

// ============================================================
//  本地模式（Windows / macOS 开发环境）
// ============================================================

function localCompile(code: string, lang: string, workDir: string): { ok: boolean; exePath?: string; error?: string } {
  if (lang === "python") {
    const srcPath = join(workDir, "main.py");
    writeFileSync(srcPath, code, "utf-8");
    return { ok: true, exePath: srcPath };
  }

  const srcFile = lang === "java" ? "Main.java" : lang === "c" ? "main.c" : "main.cpp";
  const outExe = process.platform === "win32" ? "main.exe" : "main";
  writeFileSync(join(workDir, srcFile), code, "utf-8");

  let compiler: string;
  let args: string[];
  const isWin = process.platform === "win32";
  const staticFlag = isWin ? ["-static"] : []; // Windows MinGW needs static linking
  switch (lang) {
    case "c":
      compiler = "gcc";
      args = [srcFile, "-o", outExe, "-O2", ...staticFlag];
      break;
    case "cpp":
      compiler = "g++";
      args = [srcFile, "-o", outExe, "-O2", "-std=c++17", ...staticFlag];
      break;
    case "java":
      compiler = "javac";
      args = [srcFile];
      break;
    default:
      return { ok: false, error: "Unsupported language" };
  }

  try {
    const result = execFileSync(compiler, args, {
      cwd: workDir,
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    return { ok: true, exePath: join(workDir, outExe) };
  } catch (err: any) {
    return { ok: false, error: sanitizeStderr(err.stderr ?? err.message) };
  }
}

function localRunOneTest(
  lang: string,
  exePath: string,
  input: string,
  timeLimit: number,
): { status: string; exitCode: number; time: number; memory: number; stdout: string; stderr: string } {
  let cmd: string;
  let args: string[];
  const cwd = join(exePath, "..");

  switch (lang) {
    case "c":
    case "cpp":
      cmd = exePath;
      args = [];
      break;
    case "java":
      cmd = "java";
      args = ["-cp", cwd, "Main"];
      break;
    case "python":
      cmd = "python";
      args = [exePath];
      break;
    default:
      return { status: "CE", exitCode: 1, time: 0, memory: 0, stdout: "", stderr: "Unsupported language" };
  }

  const start = Date.now();
  try {
    const result = spawnSync(cmd, args, {
      cwd,
      input,
      timeout: timeLimit + 500,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      killSignal: "SIGKILL"
    });
    const elapsed = Date.now() - start;
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const code = result.status ?? 1;
    const timedOut = result.error?.code === "ETIMEDOUT";

    return {
      status: timedOut ? "TLE" : (code === 0 ? "OK" : "RE"),
      exitCode: code,
      time: elapsed * 1_000_000,
      memory: 0,
      stdout,
      stderr: sanitizeStderr(stderr),
    };
  } catch (err: any) {
    return {
      status: "RE",
      exitCode: 1,
      time: (Date.now() - start) * 1_000_000,
      memory: 0,
      stdout: "",
      stderr: sanitizeStderr(err.message),
    };
  }
}

// ============================================================
//  统一判题入口
// ============================================================

async function judge(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId } = task;

  // 输入校验
  const validationError = validateJudgeTask(task);
  if (validationError) {
    console.warn(`[#${submissionId}] 任务校验失败: ${validationError}`);
    return { submissionId, status: "SE", timeUsed: 0, memoryUsed: 0, score: 0 };
  }

  if (JUDGE_MODE === "local") {
    return judgeLocal(task);
  }
  return judgeGoJudge(task);
}

async function judgeGoJudge(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit, memoryLimit } = task;

  const compiled = await goJudgeCompile(code, language);
  if (!compiled.ok) {
    return { submissionId, status: "CE", timeUsed: 0, memoryUsed: 0, score: 0 };
  }

  let passedCount = 0;
  let firstFailStatus = "";
  let maxTime = 0;
  let maxMemory = 0;
  const totalCount = testcases.length;

  if (totalCount === 0) {
    return { submissionId, status: "SE", timeUsed: 0, memoryUsed: 0, score: 0 };
  }

  for (const tc of testcases) {
    const r = await goJudgeRunOneTest(language, compiled.binary, code, tc.input, timeLimit, memoryLimit);

    let caseStatus: string | null = null;

    if (r.status === "TimeLimitExceeded") caseStatus = "TLE";
    else if (r.status === "MemoryLimitExceeded") caseStatus = "MLE";
    else if (r.exitCode !== 0) caseStatus = "RE";
    else {
      const stdout = (r.stdout || "").trim().replace(/\r\n/g, "\n");
      const expected = (tc.expectedOutput || "").trim().replace(/\r\n/g, "\n");
      if (stdout !== expected) caseStatus = "WA";
    }

    if (caseStatus === null) {
      passedCount++;
      maxTime = Math.max(maxTime, r.time);
      maxMemory = Math.max(maxMemory, r.memory);
    } else if (!firstFailStatus) {
      firstFailStatus = caseStatus;
      maxTime = Math.max(maxTime, r.time);
      maxMemory = Math.max(maxMemory, r.memory);
    }
  }

  if (passedCount === totalCount) {
    return { submissionId, status: "AC", timeUsed: Math.round(maxTime / 1e6), memoryUsed: Math.round(maxMemory / 1024), score: 100 };
  }

  return {
    submissionId,
    status: firstFailStatus,
    timeUsed: Math.round(maxTime / 1e6),
    memoryUsed: Math.round(maxMemory / 1024),
    score: Math.round((passedCount / totalCount) * 100),
  };
}

async function judgeLocal(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit } = task;

  const workDir = mkdtempSync(join(tmpdir(), "etloj-judge-"));

  try {
    const compiled = localCompile(code, language, workDir);
    if (!compiled.ok) {
      return { submissionId, status: "CE", timeUsed: 0, memoryUsed: 0, score: 0 };
    }

    let passedCount = 0;
    let firstFailStatus = "";
    let maxTime = 0;
    const totalCount = testcases.length;

    if (totalCount === 0) {
      return { submissionId, status: "SE", timeUsed: 0, memoryUsed: 0, score: 0 };
    }

    for (const tc of testcases) {
      const r = await localRunOneTest(language, compiled.exePath!, tc.input, timeLimit);

      let caseStatus: string | null = null;

      if (r.status === "TLE") caseStatus = "TLE";
      else if (r.exitCode !== 0) caseStatus = "RE";
      else {
        const stdout = (r.stdout || "").trim().replace(/\r\n/g, "\n");
        const expected = (tc.expectedOutput || "").trim().replace(/\r\n/g, "\n");
        if (stdout !== expected) caseStatus = "WA";
      }

      if (caseStatus === null) {
        passedCount++;
        maxTime = Math.max(maxTime, r.time);
      } else if (!firstFailStatus) {
        firstFailStatus = caseStatus;
        maxTime = Math.max(maxTime, r.time);
      }
    }

    if (passedCount === totalCount) {
      return { submissionId, status: "AC", timeUsed: Math.round(maxTime / 1e6), memoryUsed: 0, score: 100 };
    }

    return {
      submissionId,
      status: firstFailStatus,
      timeUsed: Math.round(maxTime / 1e6),
      memoryUsed: 0,
      score: Math.round((passedCount / totalCount) * 100),
    };
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

// ============================================================
//  自测运行（仅编译+运行，不记录提交）
// ============================================================

async function runSingle(task: RunTask): Promise<RunResult> {
  const { code, language, input, timeLimit } = task;

  // 输入校验
  const validationError = validateRunTask(task);
  if (validationError) {
    console.warn(`[RUN:${task.runId}] 任务校验失败: ${validationError}`);
    return { status: "SE", stdout: "", stderr: validationError, timeUsed: 0 };
  }

  if (JUDGE_MODE === "local") {
    const workDir = mkdtempSync(join(tmpdir(), "etloj-run-"));
    try {
      const compiled = localCompile(code, language, workDir);
      if (!compiled.ok) {
        return { status: "CE", stdout: "", stderr: compiled.error || "Compile error", timeUsed: 0 };
      }
      const r = localRunOneTest(language, compiled.exePath!, input, timeLimit);
      return {
        status: r.status === "OK" ? "OK" : r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        timeUsed: Math.round(r.time / 1e6),
      };
    } finally {
      try { rmSync(workDir, { recursive: true, force: true }); } catch {}
    }
  }

  // go-judge mode
  const compiled = await goJudgeCompile(code, language);
  if (!compiled.ok) {
    return { status: "CE", stdout: "", stderr: compiled.error || "Compile error", timeUsed: 0 };
  }
  const runResult = await goJudgeRun({
    cmd: language === "python" ? ["python3", "main.py"] : ["main"],
    ...(compiled.binary ? { copyIn: { main: { fileId: compiled.binary } } } : {}),
    stdin: input,
    cpuLimit: timeLimit * 1_000_000,
    memoryLimit: task.memoryLimit * 1024 * 1024,
    copyOut: ["stdout", "stderr"],
  });
  const r0 = runResult[0];
  const statusStr = r0?.status as string;
  return {
    status: statusStr === "Accepted" ? "OK" : (statusStr === "Time Limit Exceeded" ? "TLE" : (statusStr === "Memory Limit Exceeded" ? "MLE" : "RE")),
    stdout: r0?.files?.stdout || "",
    stderr: sanitizeStderr(r0?.files?.stderr || ""),
    timeUsed: Math.round((r0?.time || 0) / 1e6),
  };
}

// ============================================================
//  回调 & 主循环
// ============================================================

async function reportResult(result: JudgeResult) {
  try {
    await fetch(`${SERVER_URL}/api/submissions/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-judge-secret": JUDGE_SECRET,
      },
      body: JSON.stringify(result),
    });
    console.log(`  -> Reported: ${result.status}`);
  } catch (err) {
    console.error(`  -> Report failed:`, err);
  }
}

async function main() {
  const client = createClient({ url: REDIS_URL });
  await client.connect();
  console.log(`Judge service connected to Redis`);
  console.log(`Mode: ${JUDGE_MODE}`);
  if (JUDGE_MODE === "go-judge") {
    console.log(`Go-Judge: ${GO_JUDGE_URL}`);
  } else {
    console.log(`Local compilers: gcc, g++, python`);
    console.warn(`[!] 警告: Local 模式仅限开发环境使用，无沙箱隔离，不追踪内存用量！`);
  }
  console.log(`Callback: ${SERVER_URL}/api/submissions/callback`);
  console.log("Waiting for tasks...\n");

  // 同时监听 judge 和 run 两个队列
  while (true) {
    try {
      const result = await client.brPop([QUEUE_KEY, RUN_QUEUE_KEY], 0);
      if (!result) continue;

      // 判断来自哪个队列
      if (result.key === RUN_QUEUE_KEY) {
        // 自测运行任务
        let runTask: RunTask | null = null;
        try {
          runTask = JSON.parse(result.element);
        } catch (e) {
          console.error("Run task parse error:", e);
          continue;
        }
        console.log(`[RUN:${runTask.runId}] ${runTask.language}`);
        try {
          const runResult = await runSingle(runTask);
          console.log(`  -> ${runResult.status} (${runResult.timeUsed}ms)`);
          // 写入 Redis 供后端轮询
          await client.set(`judge:run:result:${runTask.runId}`, JSON.stringify(runResult), { EX: 300 });
        } catch (err: any) {
          console.error("Run execution error:", err);
          await client.set(`judge:run:result:${runTask.runId}`, JSON.stringify({
            status: "SE",
            stdout: "",
            stderr: sanitizeStderr(err.message || "System error"),
            timeUsed: 0,
          }), { EX: 300 });
        }
      } else {
        // 正常判题任务
        let task: JudgeTask | null = null;
        try {
          task = JSON.parse(result.element);
        } catch (e) {
          console.error("Parse error:", e);
          continue;
        }

        console.log(`[#${task.submissionId}] ${task.language} | ${task.testcases.length} cases`);

        try {
          const judgeResult = await judge(task);
          console.log(`  -> ${judgeResult.status} (${judgeResult.timeUsed}ms, ${judgeResult.memoryUsed}KB)`);
          await reportResult(judgeResult);
        } catch (err: any) {
          console.error("Judge execution error:", err);
          await reportResult({
            submissionId: task.submissionId,
            status: "SE",
            timeUsed: 0,
            memoryUsed: 0,
            score: 0,
          });
        }
      }
    } catch (err) {
      console.error("Redis pull error:", err);
    }
  }
}

main().catch(console.error);
