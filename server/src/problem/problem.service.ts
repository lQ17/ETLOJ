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

  async findAll(query: QueryProblemDto, isAdmin = false) {
    const { page = 1, pageSize = 20, difficulty, keyword, tag } = query;
    const where: any = {};

    if (!isAdmin) {
      where.isPublic = true;
    }

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

    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 20;

    const [items, total] = await Promise.all([
      this.prisma.problem.findMany({
        where,
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
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
    let acMap = new Map<number, number>();
    if (items.length > 0) {
      const acCounts = await this.prisma.submission.groupBy({
        by: ["problemId"],
        where: { status: "AC", problemId: { in: items.map((p) => p.id) } },
        _count: { id: true },
      });
      acMap = new Map(acCounts.map((a) => [a.problemId, a._count.id]));
    }

    const enriched = items.map((p) => ({
      ...p,
      totalSubmissions: p._count.submissions,
      acceptedCount: acMap.get(p.id) || 0,
      _count: undefined,
    }));

    return { items: enriched, total, page, pageSize };
  }

  async findOne(idOrSlug: number | string, isAdmin = false) {
    const problem = await this.resolveProblem(idOrSlug, isAdmin);
    let markdown = "";
    try {
      markdown = fs.readFileSync(this.getMarkdownPath(problem.slug), "utf-8");
    } catch {
      markdown = "题面文件未找到";
    }

    return { ...problem, markdown };
  }

  private async resolveProblem(idOrSlug: number | string, isAdmin = false) {
    const where = typeof idOrSlug === "number"
      ? { id: idOrSlug }
      : { slug: idOrSlug };
    const problem = await this.prisma.problem.findUnique({ where });
    if (!problem) throw new NotFoundException("该题目已被删除或不存在");
    if (!isAdmin && !problem.isPublic) throw new NotFoundException("该题目已被停用，暂不可见");
    return problem;
  }

  async getMarkdown(idOrSlug: number | string) {
    const problem = await this.resolveProblem(idOrSlug, true);

    try {
      return fs.readFileSync(this.getMarkdownPath(problem.slug), "utf-8");
    } catch {
      return "题面文件未找到";
    }
  }

  async update(idOrSlug: number | string, dto: UpdateProblemDto) {
    const problem = await this.resolveProblem(idOrSlug, true);

    if (dto.markdown) {
      fs.mkdirSync(this.getProblemDir(problem.slug), { recursive: true });
      fs.writeFileSync(this.getMarkdownPath(problem.slug), dto.markdown, "utf-8");
    }

    const { markdown, ...data } = dto;
    return this.prisma.problem.update({
      where: { id: problem.id },
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

  async delete(idOrSlug: number | string) {
    const problem = await this.resolveProblem(idOrSlug, true);

    const dir = this.getProblemDir(problem.slug);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    await this.prisma.submission.deleteMany({ where: { problemId: problem.id } });
    return this.prisma.problem.delete({ where: { id: problem.id } });
  }

  async saveTestcases(idOrSlug: number | string, testcases: { input: string; output: string }[]) {
    const problem = await this.resolveProblem(idOrSlug, true);

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
