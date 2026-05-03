import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProblemDto } from "./dto/create-problem.dto";
import { UpdateProblemDto } from "./dto/update-problem.dto";
import { QueryProblemDto } from "./dto/query-problem.dto";

@Injectable()
export class ProblemService {
  private problemsDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.problemsDir = this.config.get("PROBLEMS_DIR") || path.resolve(__dirname, "../../../problems");
  }

  private getProblemDir(slug: string) {
    return path.join(this.problemsDir, slug);
  }

  private getMarkdownPath(slug: string) {
    return path.join(this.getProblemDir(slug), "problem.md");
  }

  private getTestcasesDir(slug: string) {
    return path.join(this.getProblemDir(slug), "testcases");
  }

  async create(dto: CreateProblemDto) {
    const existing = await this.prisma.problem.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException("题目编号已存在");

    const dir = this.getProblemDir(dto.slug);
    const tcDir = this.getTestcasesDir(dto.slug);

    fs.mkdirSync(tcDir, { recursive: true });
    fs.writeFileSync(this.getMarkdownPath(dto.slug), dto.markdown, "utf-8");

    return this.prisma.problem.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        difficulty: (dto.difficulty as any) || "EASY",
        timeLimit: dto.timeLimit || 1000,
        memoryLimit: dto.memoryLimit || 256,
        filePath: this.getMarkdownPath(dto.slug),
        tags: dto.tags || [],
        isPublic: dto.isPublic ?? true,
      },
    });
  }

  async findAll(query: QueryProblemDto) {
    const { page = 1, pageSize = 20, difficulty, keyword, tag } = query;
    const where: any = {};

    if (difficulty) where.difficulty = difficulty;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { slug: { contains: keyword } },
      ];
    }
    if (tag) {
      where.tags = { contains: `"${tag}"` };
    }

    const [items, total] = await Promise.all([
      this.prisma.problem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          timeLimit: true,
          memoryLimit: true,
          tags: true,
          isPublic: true,
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.problem.count({ where }),
    ]);

    // 统计每题 AC 数量
    const acCounts = await this.prisma.submission.groupBy({
      by: ["problemId"],
      where: { status: "AC", problemId: { in: items.map((p) => p.id) } },
      _count: { id: true },
    });
    const acMap = new Map(acCounts.map((a) => [a.problemId, a._count.id]));

    const enriched = items.map((p) => ({
      ...p,
      totalSubmissions: p._count.submissions,
      acceptedCount: acMap.get(p.id) || 0,
      _count: undefined,
    }));

    return { items: enriched, total, page, pageSize };
  }

  async findOne(id: number) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException("题目不存在");

    let markdown = "";
    try {
      markdown = fs.readFileSync(this.getMarkdownPath(problem.slug), "utf-8");
    } catch {
      markdown = "题面文件未找到";
    }

    return { ...problem, markdown };
  }

  async getMarkdown(id: number) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException("题目不存在");

    try {
      return fs.readFileSync(this.getMarkdownPath(problem.slug), "utf-8");
    } catch {
      return "题面文件未找到";
    }
  }

  async update(id: number, dto: UpdateProblemDto) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException("题目不存在");

    if (dto.markdown) {
      fs.mkdirSync(this.getProblemDir(problem.slug), { recursive: true });
      fs.writeFileSync(this.getMarkdownPath(problem.slug), dto.markdown, "utf-8");
    }

    const { markdown, ...data } = dto;
    return this.prisma.problem.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.difficulty && { difficulty: data.difficulty as any }),
        ...(data.timeLimit && { timeLimit: data.timeLimit }),
        ...(data.memoryLimit && { memoryLimit: data.memoryLimit }),
        ...(data.tags && { tags: data.tags }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });
  }

  async delete(id: number) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException("题目不存在");

    // 删除文件目录
    const dir = this.getProblemDir(problem.slug);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    await this.prisma.submission.deleteMany({ where: { problemId: id } });
    return this.prisma.problem.delete({ where: { id } });
  }

  async saveTestcases(id: number, testcases: { input: string; output: string }[]) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException("题目不存在");

    const tcDir = this.getTestcasesDir(problem.slug);
    fs.mkdirSync(tcDir, { recursive: true });

    testcases.forEach((tc, i) => {
      const num = i + 1;
      fs.writeFileSync(path.join(tcDir, `${num}.in`), tc.input, "utf-8");
      fs.writeFileSync(path.join(tcDir, `${num}.out`), tc.output, "utf-8");
    });

    return { count: testcases.length };
  }

  async getTestcases(slug: string) {
    const tcDir = this.getTestcasesDir(slug);
    if (!fs.existsSync(tcDir)) return [];

    const files = fs.readdirSync(tcDir).sort();
    const testcases: { input: string; expectedOutput: string }[] = [];
    const inFiles = files.filter((f) => f.endsWith(".in"));

    for (const inFile of inFiles) {
      const num = inFile.replace(".in", "");
      const outFile = `${num}.out`;
      if (files.includes(outFile)) {
        testcases.push({
          input: fs.readFileSync(path.join(tcDir, inFile), "utf-8"),
          expectedOutput: fs.readFileSync(path.join(tcDir, outFile), "utf-8"),
        });
      }
    }

    return testcases;
  }
}
