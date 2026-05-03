import { createClient } from "redis";
import { spawnSync, execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const GO_JUDGE_URL = process.env.GO_JUDGE_URL ?? "http://localhost:5050";
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const JUDGE_SECRET = process.env.JUDGE_SECRET ?? "judge-callback-secret";
const JUDGE_MODE = process.env.JUDGE_MODE ?? "go-judge"; // "local" | "go-judge"
const QUEUE_KEY = "judge:queue";

type JudgeTask = {
  submissionId: number;
  problemId: number;
  code: string;
  language: string;
  timeLimit: number;
  memoryLimit: number;
  testcases: { input: string; expectedOutput: string }[];
};

type JudgeResult = {
  submissionId: number;
  status: string;
  timeUsed: number;
  memoryUsed: number;
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
            params.stdin !== undefined ? { content: params.stdin } : {},
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
    const stderr = result[0]?.files?.stderr ?? "";
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
      copyIn = { main: { file: binaryId! } };
      break;
    case "java":
      cmd = ["java", "Main"];
      copyIn = { "Main.class": { file: binaryId! } };
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
    stderr: (result[0]?.files?.stderr ?? "") as string,
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
    return { ok: false, error: err.stderr ?? err.message };
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
      stderr,
    };
  } catch (err: any) {
    return {
      status: "RE",
      exitCode: 1,
      time: (Date.now() - start) * 1_000_000,
      memory: 0,
      stdout: "",
      stderr: err.message,
    };
  }
}

// ============================================================
//  统一判题入口
// ============================================================

async function judge(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit, memoryLimit } = task;

  if (JUDGE_MODE === "local") {
    return judgeLocal(task);
  }
  return judgeGoJudge(task);
}

async function judgeGoJudge(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit, memoryLimit } = task;

  const compiled = await goJudgeCompile(code, language);
  if (!compiled.ok) {
    return { submissionId, status: "CE", timeUsed: 0, memoryUsed: 0 };
  }

  let maxTime = 0;
  let maxMemory = 0;

  for (const tc of testcases) {
    const r = await goJudgeRunOneTest(language, compiled.binary, code, tc.input, timeLimit, memoryLimit);

    if (r.status === "TimeLimitExceeded") {
      return { submissionId, status: "TLE", timeUsed: Math.round(r.time / 1e6), memoryUsed: Math.round(r.memory / 1024) };
    }
    if (r.status === "MemoryLimitExceeded") {
      return { submissionId, status: "MLE", timeUsed: Math.round(r.time / 1e6), memoryUsed: Math.round(r.memory / 1024) };
    }
    if (r.exitCode !== 0) {
      return { submissionId, status: "RE", timeUsed: Math.round(r.time / 1e6), memoryUsed: Math.round(r.memory / 1024) };
    }

    const stdout = r.stdout.trim();
    const expected = tc.expectedOutput.trim();
    if (stdout !== expected) {
      return { submissionId, status: "WA", timeUsed: Math.round(r.time / 1e6), memoryUsed: Math.round(r.memory / 1024) };
    }

    maxTime = Math.max(maxTime, r.time);
    maxMemory = Math.max(maxMemory, r.memory);
  }

  return {
    submissionId,
    status: "AC",
    timeUsed: Math.round(maxTime / 1e6),
    memoryUsed: Math.round(maxMemory / 1024),
  };
}

async function judgeLocal(task: JudgeTask): Promise<JudgeResult> {
  const { submissionId, code, language, testcases, timeLimit } = task;

  // Create temp workspace
  const workDir = mkdtempSync(join(tmpdir(), "etloj-judge-"));

  try {
    // Compile
    const compiled = localCompile(code, language, workDir);
    if (!compiled.ok) {
      return { submissionId, status: "CE", timeUsed: 0, memoryUsed: 0 };
    }

    let maxTime = 0;

    for (const tc of testcases) {
      const r = await localRunOneTest(language, compiled.exePath!, tc.input, timeLimit);

      if (r.status === "TLE") {
        return { submissionId, status: "TLE", timeUsed: Math.round(r.time / 1e6), memoryUsed: 0 };
      }
      if (r.exitCode !== 0) {
        return { submissionId, status: "RE", timeUsed: Math.round(r.time / 1e6), memoryUsed: 0 };
      }

      const stdout = r.stdout.trim();
      const expected = tc.expectedOutput.trim();
      if (stdout !== expected) {
        return { submissionId, status: "WA", timeUsed: Math.round(r.time / 1e6), memoryUsed: 0 };
      }

      maxTime = Math.max(maxTime, r.time);
    }

    return { submissionId, status: "AC", timeUsed: Math.round(maxTime / 1e6), memoryUsed: 0 };
  } finally {
    // Cleanup temp files
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
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
    console.log(`  → Reported: ${result.status}`);
  } catch (err) {
    console.error(`  → Report failed:`, err);
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
  }
  console.log(`Callback: ${SERVER_URL}/api/submissions/callback`);
  console.log("Waiting for tasks...\n");

  while (true) {
    try {
      const result = await client.brPop(QUEUE_KEY, 0);
      if (!result) continue;

      const task: JudgeTask = JSON.parse(result.element);
      console.log(`[#${task.submissionId}] ${task.language} | ${task.testcases.length} cases`);

      const judgeResult = await judge(task);
      console.log(`  → ${judgeResult.status} (${judgeResult.timeUsed}ms, ${judgeResult.memoryUsed}KB)`);

      await reportResult(judgeResult);
    } catch (err) {
      console.error("Judge error:", err);
    }
  }
}

main().catch(console.error);
