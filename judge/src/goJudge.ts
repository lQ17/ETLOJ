import { GO_JUDGE_URL } from "./types";
import { sanitizeStderr } from "./validation";

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

export async function goJudgeCompile(code: string, lang: string): Promise<{ ok: boolean; binary?: string; error?: string }> {
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

export async function goJudgeRunOneTest(
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
      return { status: "CE" as const, exitCode: 1, time: 0, memory: 0, stdout: "", stderr: "" };
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
