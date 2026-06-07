import { spawnSync, execFileSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { sanitizeStderr } from "./validation";

export function localCompile(code: string, lang: string, workDir: string): { ok: boolean; exePath?: string; error?: string } {
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
  const staticFlag = isWin ? ["-static"] : [];
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
    execFileSync(compiler, args, {
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

export function localRunOneTest(
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
    const timedOut = (result.error as any)?.code === "ETIMEDOUT";

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
