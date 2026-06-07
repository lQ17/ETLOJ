import { createClient } from "redis";
import type { JudgeTask, RunTask, JudgeResult } from "./types";
import { REDIS_URL, SERVER_URL, JUDGE_SECRET, JUDGE_MODE, GO_JUDGE_URL, QUEUE_KEY, RUN_QUEUE_KEY } from "./types";
import { sanitizeStderr } from "./validation";
import { judge, runSingle } from "./runner";

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
  if (!JUDGE_SECRET) {
    console.error("FATAL: JUDGE_SECRET environment variable is required");
    process.exit(1);
  }

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
        let runTask: RunTask;
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
        let task: JudgeTask;
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
