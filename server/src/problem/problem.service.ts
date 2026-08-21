import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DIFFICULTY_VALUES, getDefaultScore } from './difficulty.constants';
import type { DifficultyLevel } from './difficulty.constants';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { QueryProblemDto } from './dto/query-problem.dto';
import { TestcaseStoreService } from '../testcase/testcase-store.service';

@Injectable()
export class ProblemService {
  private problemsDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly testcaseStore: TestcaseStoreService,
  ) {
    this.problemsDir =
      this.config.get('PROBLEMS_DIR') ||
      path.resolve(__dirname, '../../../problems');
  }

  /** 将任意难度字符串映射为合法的 Difficulty 枚举值，无法识别时返回 IRON */
  private normalizeDifficulty(raw?: string): DifficultyLevel {
    if (!raw) return 'IRON';
    const upper = raw.trim().toUpperCase();
    if (DIFFICULTY_VALUES.includes(upper as DifficultyLevel)) {
      return upper as DifficultyLevel;
    }
    // 兼容旧版枚举 / 中文别名
    const ALIASES: Record<string, DifficultyLevel> = {
      EASY: 'IRON',
      MEDIUM: 'BRONZE',
      HARD: 'SILVER',
      黑铁: 'IRON',
      青铜: 'BRONZE',
      白银: 'SILVER',
      黄金: 'GOLD',
      铂金: 'PLATINUM',
      钻石: 'DIAMOND',
      大师: 'MASTER',
      王者: 'CHAMPION',
      传说: 'LEGENDARY',
    };
    return ALIASES[upper] ?? 'IRON';
  }

  private getProblemDir(slug: string) {
    // 防止路径穿越攻击
    if (/\.\.|[\/\\]/.test(slug)) {
      throw new BadRequestException('slug 不能包含路径分隔符或 ..');
    }
    return path.join(this.problemsDir, slug);
  }

  private getMarkdownPath(slug: string) {
    return path.join(this.getProblemDir(slug), 'problem.md');
  }

  private getTestcasesDir(slug: string) {
    return path.join(this.getProblemDir(slug), 'testcases');
  }

  /** 确保 markdown 第一行为 `# {slug} {title}` */
  private ensureHeading(markdown: string, slug: string, title: string): string {
    const heading = `# ${slug} ${title}`;
    const stripped = markdown.replace(/^#[^\n]*\n?/, '');
    return `${heading}\n${stripped}`;
  }

  async create(dto: CreateProblemDto) {
    const existing = await this.prisma.problem.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('题目编号已存在');

    const dir = this.getProblemDir(dto.slug);
    const tcDir = this.getTestcasesDir(dto.slug);

    fs.mkdirSync(tcDir, { recursive: true });
    const mdContent = this.ensureHeading(
      dto.markdown || '',
      dto.slug,
      dto.title,
    );
    fs.writeFileSync(this.getMarkdownPath(dto.slug), mdContent, 'utf-8');

    // 如果有 tagIds，获取标签名称用于 JSON 字段
    let tagNames: string[] = dto.tags || [];
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.prisma.tag.findMany({
        where: { id: { in: dto.tagIds } },
        select: { name: true },
      });
      tagNames = tags.map((t) => t.name);
    }

    const difficulty = this.normalizeDifficulty(dto.difficulty as string);
    const score = dto.score ?? getDefaultScore(difficulty);

    const problem = await this.prisma.problem.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        difficulty,
        timeLimit: dto.timeLimit || 1000,
        memoryLimit: dto.memoryLimit || 256,
        filePath: this.getMarkdownPath(dto.slug),
        tags: tagNames,
        isPublic: dto.isPublic ?? true,
        score,
      },
    });

    // 创建 ProblemTag 关联
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.prisma.problemTag.createMany({
        data: dto.tagIds.map((tagId) => ({ problemId: problem.id, tagId })),
      });
    }

    return problem;
  }

  async findAll(query: QueryProblemDto, isAdmin = false) {
    const {
      page = 1,
      pageSize = 20,
      difficulty,
      keyword,
      content,
      tag,
      tags,
      tagMode = 'OR',
    } = query;
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

    // 兼容旧的单标签筛选
    if (tag) {
      where.tags = { contains: `"${tag}"` };
    }

    // 多标签筛选
    if (tags && tags.length > 0) {
      if (tagMode === 'AND') {
        // AND 模式：题目必须包含所有选中标签
        where.AND = tags.map((t) => ({
          problemTags: { some: { tag: { name: t } } },
        }));
      } else {
        // OR 模式：题目包含任一选中标签
        where.problemTags = { some: { tag: { name: { in: tags } } } };
      }
    }

    // 题面保存在 Markdown 文件中。内容搜索只在用户明确提供 content 时执行，
    // 避免普通列表查询扫描整个题库；扫描上限也防止误用拖慢服务端。
    const contentNeedle = content?.trim().toLocaleLowerCase();
    if (contentNeedle) {
      const candidates = await this.prisma.problem.findMany({
        where,
        select: { id: true, slug: true },
        take: 10000,
      });
      const matchedIds: number[] = [];
      for (const candidate of candidates) {
        try {
          const markdown = fs.readFileSync(
            this.getMarkdownPath(candidate.slug),
            'utf-8',
          );
          if (markdown.toLocaleLowerCase().includes(contentNeedle))
            matchedIds.push(candidate.id);
        } catch {
          // 缺失题面文件的题目不匹配内容搜索。
        }
      }
      where.id = { in: matchedIds };
    }

    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 20;

    const [items, total] = await Promise.all([
      this.prisma.problem.findMany({
        where,
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          timeLimit: true,
          memoryLimit: true,
          tags: true,
          isPublic: true,
          score: true,
          problemTags: {
            select: { tag: { select: { id: true, name: true } } },
          },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.problem.count({ where }),
    ]);

    // 统计每题 AC 数量
    let acMap = new Map<number, number>();
    if (items.length > 0) {
      const acCounts = await this.prisma.submission.groupBy({
        by: ['problemId'],
        where: { status: 'AC', problemId: { in: items.map((p) => p.id) } },
        _count: { id: true },
      });
      acMap = new Map(acCounts.map((a) => [a.problemId, a._count.id]));
    }

    const enriched = items.map((p) => ({
      ...p,
      tags: p.problemTags.map((pt) => pt.tag.name),
      problemTags: undefined,
      totalSubmissions: p._count.submissions,
      acceptedCount: acMap.get(p.id) || 0,
      stats: {
        totalSubmissions: p._count.submissions,
        acceptedSubmissions: acMap.get(p.id) || 0,
        acceptanceRate:
          p._count.submissions === 0
            ? 0
            : (acMap.get(p.id) || 0) / p._count.submissions,
      },
      _count: undefined,
    }));

    return { items: enriched, total, page, pageSize };
  }

  async findOne(idOrSlug: number | string, isAdmin = false) {
    const problem = await this.resolveProblem(idOrSlug, isAdmin);
    let markdown = '';
    try {
      markdown = fs.readFileSync(this.getMarkdownPath(problem.slug), 'utf-8');
    } catch {
      markdown = '题面文件未找到';
    }

    // 详情接口只返回面向客户端的字段，避免泄露服务器内部文件路径。
    const [problemTags, totalSubmissions, acceptedSubmissions] =
      await Promise.all([
        this.prisma.problemTag.findMany({
          where: { problemId: problem.id },
          select: { tag: { select: { id: true, name: true } } },
        }),
        this.prisma.submission.count({ where: { problemId: problem.id } }),
        this.prisma.submission.count({
          where: { problemId: problem.id, status: 'AC' },
        }),
      ]);

    // 获取测试用例数量（不加载内容）
    const testcaseCount = (await this.testcaseStore.scan(problem.slug))
      .testcaseCount;

    const {
      filePath: _filePath,
      tags: _legacyTags,
      ...publicProblem
    } = problem;

    return {
      ...publicProblem,
      markdown,
      tagIds: problemTags.map((pt) => pt.tag.id),
      tags: problemTags.map((pt) => pt.tag.name),
      testcaseCount,
      stats: {
        totalSubmissions,
        acceptedSubmissions,
        acceptanceRate:
          totalSubmissions === 0 ? 0 : acceptedSubmissions / totalSubmissions,
      },
    };
  }

  private async resolveProblem(idOrSlug: number | string, isAdmin = false) {
    const where =
      typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug };
    const problem = await this.prisma.problem.findUnique({ where });
    if (!problem) throw new NotFoundException('该题目已被删除或不存在');
    if (!isAdmin && !problem.isPublic)
      throw new NotFoundException('该题目已被停用，暂不可见');
    return problem;
  }

  async findAdminProblemReference(idOrSlug: number | string) {
    const problem = await this.resolveProblem(idOrSlug, true);
    return { id: problem.id, slug: problem.slug, title: problem.title };
  }

  async getMarkdown(idOrSlug: number | string) {
    const problem = await this.resolveProblem(idOrSlug, false);

    try {
      return fs.readFileSync(this.getMarkdownPath(problem.slug), 'utf-8');
    } catch {
      return '题面文件未找到';
    }
  }

  async update(idOrSlug: number | string, dto: UpdateProblemDto) {
    const problem = await this.resolveProblem(idOrSlug, true);

    if (dto.markdown !== undefined) {
      fs.mkdirSync(this.getProblemDir(problem.slug), { recursive: true });
      const mdContent = this.ensureHeading(
        dto.markdown || '',
        problem.slug,
        dto.title || problem.title,
      );
      fs.writeFileSync(this.getMarkdownPath(problem.slug), mdContent, 'utf-8');
    } else if (dto.title && dto.title !== problem.title) {
      // 仅改标题时也要更新 md 文件的 heading
      let md = '';
      try {
        md = fs.readFileSync(this.getMarkdownPath(problem.slug), 'utf-8');
      } catch {}
      if (md) {
        const mdContent = this.ensureHeading(md, problem.slug, dto.title);
        fs.writeFileSync(
          this.getMarkdownPath(problem.slug),
          mdContent,
          'utf-8',
        );
      }
    }

    const { markdown, tagIds, ...data } = dto;

    // 更新标签关联
    if (tagIds !== undefined) {
      // 删除旧关联
      await this.prisma.problemTag.deleteMany({
        where: { problemId: problem.id },
      });
      // 创建新关联
      if (tagIds.length > 0) {
        await this.prisma.problemTag.createMany({
          data: tagIds.map((tid) => ({ problemId: problem.id, tagId: tid })),
        });
      }
      // 同步更新 JSON tags 字段
      if (tagIds.length > 0) {
        const tags = await this.prisma.tag.findMany({
          where: { id: { in: tagIds } },
          select: { name: true },
        });
        data.tags = tags.map((t) => t.name);
      } else {
        data.tags = [];
      }
    }

    return this.prisma.problem.update({
      where: { id: problem.id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.difficulty && { difficulty: data.difficulty as any }),
        ...(data.timeLimit && { timeLimit: data.timeLimit }),
        ...(data.memoryLimit && { memoryLimit: data.memoryLimit }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.score !== undefined && { score: data.score }),
      },
    });
  }

  async delete(idOrSlug: number | string) {
    const problem = await this.resolveProblem(idOrSlug, true);

    const dir = this.getProblemDir(problem.slug);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    await this.prisma.$transaction([
      this.prisma.solution.deleteMany({ where: { problemId: problem.id } }),
      this.prisma.submission.deleteMany({ where: { problemId: problem.id } }),
      this.prisma.problemListItem.deleteMany({
        where: { problemId: problem.id },
      }),
      this.prisma.contestProblem.deleteMany({
        where: { problemId: problem.id },
      }),
      this.prisma.problem.delete({ where: { id: problem.id } }),
    ]);
  }

  async saveTestcases(
    idOrSlug: number | string,
    testcases: { input: string; output: string }[],
  ) {
    const problem = await this.resolveProblem(idOrSlug, true);
    const result = await this.testcaseStore.replaceAll(
      problem.slug,
      testcases.map((testcase) => ({
        input: testcase.input,
        expectedOutput: testcase.output,
      })),
    );
    return { count: result.testcaseCount };
  }

  async getTestcases(slug: string) {
    return this.testcaseStore.readAll(slug);
  }

  async deleteTestcase(idOrSlug: number | string, num: number) {
    const problem = await this.resolveProblem(idOrSlug, true);
    const current = await this.testcaseStore.scan(problem.slug);
    const result = await this.testcaseStore.deleteAndRenumber(
      problem.slug,
      num,
      current.revision,
    );
    return { count: result.testcaseCount };
  }
}
