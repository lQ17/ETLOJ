import assert from "node:assert/strict";
import test from "node:test";
import {
  createConnectedQueueClients,
  deliverResult,
  moveToDeadLetter,
  recoverInterruptedTasks,
} from "../src/index";
import {
  DEAD_LETTER_QUEUE_KEY,
  PROCESSING_QUEUE_KEY,
  QUEUE_KEY,
  type JudgeResult,
} from "../src/types";
import { judge } from "../src/runner";

const result: JudgeResult = {
  submissionId: 10,
  status: "AC",
  timeUsed: 12,
  memoryUsed: 100,
  score: 100,
  testcases: [],
};

test("uses independent Redis connections for blocking queues", async () => {
  const connected: string[] = [];
  const runClient = {
    connect: async () => { connected.push("run"); },
  };
  const judgeClient = {
    duplicate: () => runClient,
    connect: async () => { connected.push("judge"); },
  };

  const clients = await createConnectedQueueClients(() => judgeClient);

  assert.equal(clients.judgeClient, judgeClient);
  assert.equal(clients.runClient, runClient);
  assert.notEqual(clients.judgeClient, clients.runClient);
  assert.deepEqual(connected.sort(), ["judge", "run"]);
});

test("accepts a callback only when the server returns 2xx", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    assert.equal(await deliverResult(result), "accepted");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("moves permanently rejected callbacks toward the dead-letter path", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad", { status: 400 });
  try {
    assert.equal(await deliverResult(result), "dead-letter");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recovers every task left in processing after a crash", async () => {
  const calls: Array<[string, string]> = [];
  const pending = ["task-1", "task-2", null];
  const client = {
    rPopLPush: async (source: string, destination: string) => {
      calls.push([source, destination]);
      return pending.shift();
    },
  };

  await recoverInterruptedTasks(client);
  assert.deepEqual(calls, [
    [PROCESSING_QUEUE_KEY, QUEUE_KEY],
    [PROCESSING_QUEUE_KEY, QUEUE_KEY],
    [PROCESSING_QUEUE_KEY, QUEUE_KEY],
  ]);
});

test("dead-lettering removes processing and records evidence atomically", async () => {
  const operations: unknown[] = [];
  const transaction = {
    lRem: (...args: unknown[]) => { operations.push(["lRem", ...args]); return transaction; },
    lPush: (...args: unknown[]) => { operations.push(["lPush", ...args]); return transaction; },
    exec: async () => { operations.push(["exec"]); },
  };
  const client = { multi: () => transaction };

  await moveToDeadLetter(client, "raw-task", "invalid", result);
  assert.deepEqual((operations[0] as unknown[]).slice(0, 4), [
    "lRem", PROCESSING_QUEUE_KEY, 1, "raw-task",
  ]);
  assert.equal((operations[1] as unknown[])[1], DEAD_LETTER_QUEUE_KEY);
  assert.deepEqual(operations[2], ["exec"]);
});

test("returns a sanitized diagnostic for invalid judge tasks", async () => {
  const judged = await judge({
    submissionId: 99,
    problemId: 1,
    code: "int main() {}",
    language: "unsupported",
    timeLimit: 1000,
    memoryLimit: 256,
    testcases: [],
  });

  assert.equal(judged.status, "SE");
  assert.match(judged.diagnostic || "", /不支持的语言/);
});
