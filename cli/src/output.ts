import Table from "cli-table3";
import pc from "picocolors";
import type { LibraryDetail, LibrarySummary, OutputFormat, ProblemDetail, ProblemListResponse, ProblemStatusResult, ProblemSummary, Tag } from "./types.js";

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printNdjson(items: unknown[]): void {
  for (const item of items) process.stdout.write(`${JSON.stringify(item)}\n`);
}

function short(value: string, length = 42): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function printProblemList(response: ProblemListResponse): void {
  const table = new Table({
    head: [pc.bold("Slug"), pc.bold("标题"), pc.bold("时间限制"), pc.bold("内存限制"), pc.bold("分值"), pc.bold("标签"), pc.bold("统计")],
    colWidths: [16, 32, 12, 12, 8, 28, 18],
    wordWrap: true,
  });
  for (const item of response.items) {
    table.push([
      item.slug,
      short(item.title),
      `${item.timeLimit} ms`,
      `${item.memoryLimit} MB`,
      String(item.score),
      item.tags.join(", "),
      `${item.stats.acceptedSubmissions}/${item.stats.totalSubmissions} (${(item.stats.acceptanceRate * 100).toFixed(1)}%)`,
    ]);
  }
  const suffix = response.truncated ? "，结果已达到本次 limit 上限" : "";
  process.stdout.write(`${table.toString()}\n共 ${response.total} 题，第 ${response.page} 页${suffix}\n`);
}

export function printProblemDetail(problem: ProblemSummary | ProblemDetail): void {
  const rows = [
    ["Slug", problem.slug],
    ["标题", problem.title],
    ["时间限制", `${problem.timeLimit} ms`],
    ["内存限制", `${problem.memoryLimit} MB`],
    ["分值", problem.score],
    ["标签", problem.tags.join(", ") || "无"],
    ["统计", `${problem.stats.acceptedSubmissions}/${problem.stats.totalSubmissions} (${(problem.stats.acceptanceRate * 100).toFixed(2)}%)`],
  ];
  const table = new Table({ colWidths: [14, 76], wordWrap: true });
  for (const row of rows) table.push({ [String(row[0])]: String(row[1]) });
  process.stdout.write(`${table.toString()}\n\nMarkdown:\n${problem.markdown || ""}\n`);
}

export function printTags(tags: Tag[]): void {
  const table = new Table({ head: [pc.bold("ID"), pc.bold("名称"), pc.bold("题目数"), pc.bold("描述")] });
  for (const tag of tags) table.push([tag.id, tag.name, tag._count?.problems ?? "-", tag.description || ""]);
  process.stdout.write(`${table.toString()}\n`);
}

export function printProblemStatus(result: ProblemStatusResult): void {
  const statusText = result.passed ? "已通过" : result.status === "ATTEMPTED" ? "已提交但未通过" : "未提交";
  process.stdout.write(`${result.slug} ${result.title}\n状态：${statusText}（${result.status}）\n`);
}

export function printLibraryList(response: { items: LibrarySummary[]; total: number; page: number; pageSize: number; truncated?: boolean }): void {
  const table = new Table({
    head: [pc.bold("ID"), pc.bold("题库名称"), pc.bold("创建者"), pc.bold("题目数"), pc.bold("已通过"), pc.bold("描述")],
    colWidths: [7, 28, 18, 10, 10, 42],
    wordWrap: true,
  });
  for (const item of response.items) {
    table.push([
      String(item.id),
      short(item.title, 36),
      item.creator?.username || "-",
      String(item.problemCount),
      item.acCount === undefined ? "-" : String(item.acCount),
      short(item.description || "", 54),
    ]);
  }
  const suffix = response.truncated ? "，结果已达到本次 limit 上限" : "";
  process.stdout.write(`${table.toString()}\n共 ${response.total} 个题库，第 ${response.page} 页${suffix}\n`);
}

export function printLibraryDetail(library: LibraryDetail): void {
  process.stdout.write(`题库：${library.title}\n创建者：${library.creator.username}\n描述：${library.description || "无"}\n\n`);
  const table = new Table({ head: [pc.bold("Slug"), pc.bold("标题"), pc.bold("难度"), pc.bold("分值")] });
  for (const item of library.items) {
    table.push([item.problem.slug, item.problem.title, item.problem.difficulty, item.problem.score]);
  }
  process.stdout.write(`${table.toString()}\n共 ${library.items.length} 道题\n`);
}

export function printFormatted(value: unknown, format: OutputFormat, tablePrinter: () => void): void {
  if (format === "json") return printJson(value);
  if (format === "ndjson") {
    const items = Array.isArray(value) ? value : "items" in (value as object) ? (value as { items: unknown[] }).items : [value];
    return printNdjson(items);
  }
  tablePrinter();
}

export function getField(value: unknown, field: string): unknown {
  let current: unknown = value;
  for (const part of field.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      throw new Error(`字段不存在：${field}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
