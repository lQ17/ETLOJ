import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { DIFFICULTY_VALUES, getDefaultScore } from "./difficulty.constants";
import type { DifficultyLevel } from "./difficulty.constants";

@Injectable()
export class ProblemImportExportService {
  private problemsDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.problemsDir = this.config.get("PROBLEMS_DIR") || path.resolve(__dirname, "../../../problems");
  }

  /** 将任意难度字符串映射为合法的 Difficulty 枚举值，无法识别时返回 IRON */
  private normalizeDifficulty(raw?: string): DifficultyLevel {
    if (!raw) return "IRON";
    const upper = raw.trim().toUpperCase();
    if (DIFFICULTY_VALUES.includes(upper as DifficultyLevel)) {
      return upper as DifficultyLevel;
    }
    const ALIASES: Record<string, DifficultyLevel> = {
      EASY: "IRON", MEDIUM: "BRONZE", HARD: "SILVER",
      黑铁: "IRON", 青铜: "BRONZE", 白银: "SILVER", 黄金: "GOLD",
      铂金: "PLATINUM", 钻石: "DIAMOND", 大师: "MASTER",
      王者: "CHAMPION", 传说: "LEGENDARY",
    };
    return ALIASES[upper] ?? "IRON";
  }

  private getProblemDir(slug: string) {
    if (/\.\.|[\/\\]/.test(slug)) {
      throw new BadRequestException("slug 不能包含路径分隔符或 ..");
    }
    return path.join(this.problemsDir, slug);
  }

  /** 确保 markdown 第一行为 `# {slug} {title}`（以 problem.json 为准） */
  private ensureHeading(markdown: string, slug: string, title: string): string {
    const heading = `# ${slug} ${title}`;
    const stripped = markdown.replace(/^#[^\n]*\n?/, "");
    return `${heading}\n${stripped}`;
  }

  private getMarkdownPath(slug: string) {
    return path.join(this.getProblemDir(slug), "problem.md");
  }

  private getTestcasesDir(slug: string) {
    return path.join(this.getProblemDir(slug), "testcases");
  }

  async exportProblems(slugs: string[]): Promise<Buffer> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    for (const slug of slugs) {
      const problem = await this.prisma.problem.findUnique({ where: { slug } });
      if (!problem) continue;

      const prefix = slug;

      // problem.json
      const meta = {
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        score: problem.score,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
        tags: problem.tags,
        isPublic: problem.isPublic,
      };
      zip.addFile(`${prefix}/problem.json`, Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'));

      // problem.md
      let markdown = '';
      try { markdown = fs.readFileSync(this.getMarkdownPath(slug), 'utf-8'); } catch {}
      zip.addFile(`${prefix}/problem.md`, Buffer.from(markdown, 'utf-8'));

      // testcases
      const tcDir = this.getTestcasesDir(slug);
      if (fs.existsSync(tcDir)) {
        const files = fs.readdirSync(tcDir);
        for (const file of files) {
          const content = fs.readFileSync(path.join(tcDir, file), 'utf-8');
          zip.addFile(`${prefix}/testcases/${file}`, Buffer.from(content, 'utf-8'));
        }
      }
    }

    return zip.toBuffer();
  }

  async exportAllProblems(): Promise<Buffer> {
    const problems = await this.prisma.problem.findMany({ select: { slug: true } });
    return this.exportProblems(problems.map(p => p.slug));
  }

  async importProblems(zipBuffer: Buffer): Promise<{ imported: number; skipped: string[]; errors: string[] }> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Group entries by top-level directory
    const dirMap = new Map<string, typeof entries>();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const parts = entry.entryName.split('/');
      if (parts.length < 2) continue; // skip root-level files
      const dir = parts[0];
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir)!.push(entry);
    }

    let imported = 0;
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const [dir, dirEntries] of dirMap) {
      try {
        // Read problem.json
        const jsonEntry = dirEntries.find(e => e.entryName.endsWith('problem.json'));
        if (!jsonEntry) { errors.push(`${dir}: 缺少 problem.json`); continue; }

        const meta = JSON.parse(jsonEntry.getData().toString('utf-8'));
        if (!meta.slug) { errors.push(`${dir}: problem.json 缺少 slug`); continue; }

        // Check conflict
        const existing = await this.prisma.problem.findUnique({ where: { slug: meta.slug } });
        if (existing) { skipped.push(meta.slug); continue; }

        // Write files
        const tcDir = this.getTestcasesDir(meta.slug);
        fs.mkdirSync(tcDir, { recursive: true });

        // Write problem.md（第一行强制为 # {slug} {title}，以 problem.json 为准）
        const mdEntry = dirEntries.find(e => e.entryName.endsWith('problem.md'));
        const importTitle = meta.title || meta.slug;
        let markdown = mdEntry ? mdEntry.getData().toString('utf-8') : '';
        markdown = this.ensureHeading(markdown, meta.slug, importTitle);
        fs.writeFileSync(this.getMarkdownPath(meta.slug), markdown, 'utf-8');

        // Write testcases
        for (const entry of dirEntries) {
          if (entry.entryName.includes('/testcases/') && !entry.isDirectory) {
            const filename = entry.entryName.split('/testcases/')[1];
            if (filename) {
              fs.writeFileSync(path.join(tcDir, filename), entry.getData(), 'utf-8');
            }
          }
        }

        // Create DB record
        const importDifficulty = this.normalizeDifficulty(meta.difficulty);
        const importScore = meta.score ?? getDefaultScore(importDifficulty);

        // 先按名称查找数据库中已有的标签
        const tagNames: string[] = meta.tags || [];
        let matchedTagNames: string[] = [];
        if (tagNames.length > 0) {
          const matchedTags = await this.prisma.tag.findMany({
            where: { name: { in: tagNames } },
            select: { id: true, name: true },
          });
          matchedTagNames = matchedTags.map(t => t.name);

          const problem = await this.prisma.problem.create({
            data: {
              slug: meta.slug,
              title: meta.title || meta.slug,
              difficulty: importDifficulty,
              score: importScore,
              timeLimit: meta.timeLimit || 1000,
              memoryLimit: meta.memoryLimit || 256,
              filePath: this.getMarkdownPath(meta.slug),
              tags: matchedTagNames,
              isPublic: meta.isPublic ?? true,
            },
          });

          if (matchedTags.length > 0) {
            await this.prisma.problemTag.createMany({
              data: matchedTags.map(t => ({ problemId: problem.id, tagId: t.id })),
            });
          }
        } else {
          await this.prisma.problem.create({
            data: {
              slug: meta.slug,
              title: meta.title || meta.slug,
              difficulty: importDifficulty,
              score: importScore,
              timeLimit: meta.timeLimit || 1000,
              memoryLimit: meta.memoryLimit || 256,
              filePath: this.getMarkdownPath(meta.slug),
              tags: [],
              isPublic: meta.isPublic ?? true,
            },
          });
        }

        imported++;
      } catch (e: any) {
        errors.push(`${dir}: ${e.message}`);
      }
    }

    return { imported, skipped, errors };
  }
}
