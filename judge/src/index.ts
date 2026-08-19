import { createClient } from "redis";
import type { JudgeTask, RunTask, JudgeResult } from "./types";
import {
  REDIS_URL,
  SERVER_URL,
  JUDGE_SECRET,
  JUDGE_MODE,
  GO_JUDGE_URL,
  QUEUE_KEY,
  RUN_QUEUE_KEY,
  PROCESSING_QUEUE_KEY,
  DEAD_LETTER_QUEUE_KEY,
} from "./types";
import { sanitizeStderr } from "./validation";
import { judge, runSingle } from "./runner";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function reportResult(result: JudgeResult): Promise<Response | null> {
  try {
    return await fetch(`${SERVER_URL}/api/submissions/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-judge-secret": JUDGE_SECRET,
      },
      body: JSON.stringify(result),
    });
  } catch (err) {
    console.error(`  -> Report failed:`, err);
    return null;
  }
}

export async function deliverResult(result: JudgeResult): Promise<"accepted" | "dead-letter"> {
  let attempt = 0;
  while (true) {
    attempt++;
    const response = await reportResult(result);
    if (response?.ok) {
      console.log(`  -> Reported: ${result.status}`);
      return "accepted";
    }

    // 请求内容不可接受或提交已被删除时不应阻塞整个判题机，交给死信队列留痕。
    if (response && [400, 404, 422].includes(response.status)) {
      console.error(`  -> Callback rejected permanently: HTTP ${response.status}`);
      return "dead-letter";
    }

    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
    console.error(`  -> Callback unavailable${response ? `: HTTP ${response.status}` : ""}; retrying in ${delay}ms`);
    await sleep(delay);
  }
}

export async function moveToDeadLetter(client: any, rawTask: string, reason: string, result?: JudgeResult) {
  await client.multi()
    .lRem(PROCESSING_QUEUE_KEY, 1, rawTask)
    .lPush(DEAD_LETTER_QUEUE_KEY, JSON.stringify({ rawTask, reason, result, failedAt: new Date().toISOString() }))
    .exec();
}

export async function recoverInterruptedTasks(client: any) {
  let recovered = 0;
  while (await client.rPopLPush(PROCESSING_QUEUE_KEY, QUEUE_KEY)) recovered++;
  if (recovered > 0) console.warn(`Recovered ${recovered} interrupted judge task(s)`);
}

async function runQueueLoop(client: any) {
  while (true) {
    try {
      const result = await client.brPop(RUN_QUEUE_KEY, 0);
      if (!result) continue;
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
    } catch (err) {
      console.error("Redis run-queue error:", err);
      await sleep(1000);
    }
  }
}

async function judgeQueueLoop(client: any) {
  while (true) {
    let rawTask: string | null = null;
    try {
      // 原子地从待判队列移入处理中队列；只有成功回调后才确认删除。
      rawTask = await client.brPopLPush(QUEUE_KEY, PROCESSING_QUEUE_KEY, 0);
      if (!rawTask) continue;

      let task: JudgeTask;
      try {
        task = JSON.parse(rawTask);
      } catch (e) {
        console.error("Parse error:", e);
        await moveToDeadLetter(client, rawTask, "invalid task JSON");
        continue;
      }

      console.log(`[#${task.submissionId}] ${task.language} | ${task.testcases.length} cases`);
      let judgeResult: JudgeResult;
      try {
        judgeResult = await judge(task);
        console.log(`  -> ${judgeResult.status} (${judgeResult.timeUsed}ms, ${judgeResult.memoryUsed}KB)`);
      } catch (err: any) {
        console.error("Judge execution error:", err);
        judgeResult = {
          submissionId: task.submissionId,
          status: "SE",
          timeUsed: 0,
          memoryUsed: 0,
          score: 0,
          testcases: [],
        };
      }

      const delivery = await deliverResult(judgeResult);
      if (delivery === "accepted") {
        await client.lRem(PROCESSING_QUEUE_KEY, 1, rawTask);
      } else {
        await moveToDeadLetter(client, rawTask, "callback rejected", judgeResult);
      }
    } catch (err) {
      // rawTask 若已被取出会继续留在 processing，进程重启时自动恢复，绝不静默丢弃。
      console.error("Judge queue error:", err);
      await sleep(1000);
    }
  }
}

export async function createConnectedQueueClients(
  factory: () => any = () => createClient({ url: REDIS_URL }),
) {
  const judgeClient = factory();
  // Blocking Redis commands monopolize a connection until a task arrives.
  // The run queue must therefore use a dedicated connection, otherwise its
  // BRPOP can prevent judge tasks and acknowledgements from being processed.
  const runClient = judgeClient.duplicate();
  await Promise.all([judgeClient.connect(), runClient.connect()]);
  return { judgeClient, runClient };
}

async function main() {
  if (!JUDGE_SECRET) {
    console.error("FATAL: JUDGE_SECRET environment variable is required");
    process.exit(1);
  }

  const { judgeClient, runClient } = await createConnectedQueueClients();
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

  await recoverInterruptedTasks(judgeClient);
  await Promise.all([
    judgeQueueLoop(judgeClient),
    runQueueLoop(runClient),
  ]);
}

if (require.main === module) {
  main().catch(console.error);
}
