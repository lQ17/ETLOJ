#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { exitCodeFor, registerCommands } from "./commands.js";

const program = new Command();
program
  .name("etloj")
  .description("ETLOJ 题目查询命令行工具")
  .version("0.1.0")
  .showSuggestionAfterError();

registerCommands(program);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${pc.red(`错误：${message}`)}\n`);
  process.exitCode = exitCodeFor(error);
}
