import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ApiConfig } from "./types.js";

const DEFAULT_API_URL = "http://localhost:3000/api";

function configPath(): string {
  const baseDir = process.env.APPDATA || process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(baseDir, "etloj", "config.json");
}

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export async function loadConfig(): Promise<ApiConfig> {
  let stored: Partial<ApiConfig> = {};
  try {
    stored = JSON.parse(await readFile(configPath(), "utf8")) as Partial<ApiConfig>;
  } catch {
    // A missing or invalid local config behaves like a fresh installation.
  }

  return {
    apiUrl: normalizeApiUrl(process.env.ETLOJ_API_URL || stored.apiUrl || DEFAULT_API_URL),
    token: process.env.ETLOJ_TOKEN || stored.token,
  };
}

export async function saveConfig(patch: Partial<ApiConfig>): Promise<ApiConfig> {
  const current = await loadConfig();
  const next: ApiConfig = {
    ...current,
    ...patch,
    apiUrl: normalizeApiUrl(patch.apiUrl || current.apiUrl),
  };
  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(file, 0o600);
  } catch {
    // chmod is not meaningful on every supported platform.
  }
  return next;
}

export async function clearToken(): Promise<ApiConfig> {
  const current = await loadConfig();
  delete current.token;
  return saveConfig(current);
}

export function getConfigFilePath(): string {
  return configPath();
}
