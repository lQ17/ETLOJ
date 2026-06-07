export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
export const GO_JUDGE_URL = process.env.GO_JUDGE_URL ?? "http://127.0.0.1:5050";
export const SERVER_URL = process.env.SERVER_URL ?? "http://127.0.0.1:3000";
export const JUDGE_SECRET = process.env.JUDGE_SECRET ?? "";
export const JUDGE_MODE = process.env.JUDGE_MODE ?? "local"; // "local" | "go-judge"
export const QUEUE_KEY = "judge:queue";
export const RUN_QUEUE_KEY = "judge:run";

export const SUPPORTED_LANGUAGES = ["c", "cpp", "java", "python"];
export const MAX_CODE_LENGTH = 50000;
export const MAX_RUN_INPUT_LENGTH = 10000;

export type JudgeTask = {
  submissionId: number;
  problemId: number;
  code: string;
  language: string;
  timeLimit: number;
  memoryLimit: number;
  testcases: { input: string; expectedOutput: string }[];
};

export type RunTask = {
  runId: string;
  code: string;
  language: string;
  input: string;
  timeLimit: number;
  memoryLimit: number;
};

export type RunResult = {
  status: string;
  stdout: string;
  stderr: string;
  timeUsed: number;
};

export type JudgeResult = {
  submissionId: number;
  status: string;
  timeUsed: number;
  memoryUsed: number;
  score: number;
};
