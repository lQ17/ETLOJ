/**
 * 数据迁移脚本：将 Problem.tags JSON 字段迁移到 Tag + ProblemTag 表
 *
 * 运行方式：npx tsx scripts/migrate-tags.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("开始迁移标签数据...");

  // 1. 获取所有题目的 tags JSON 字段
  const problems = await prisma.problem.findMany({
    select: { id: true, tags: true },
  });

  // 2. 提取所有唯一标签
  const allTags = new Set<string>();
  for (const problem of problems) {
    const tags = problem.tags as string[] | null;
    if (Array.isArray(tags)) {
      tags.forEach(t => allTags.add(t));
    }
  }

  console.log(`找到 ${allTags.size} 个唯一标签:`, [...allTags]);

  if (allTags.size === 0) {
    console.log("没有需要迁移的标签数据");
    return;
  }

  // 3. 创建 Tag 记录（跳过已存在的）
  const tagMap = new Map<string, number>();
  for (const name of allTags) {
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      tagMap.set(name, existing.id);
      console.log(`标签 "${name}" 已存在，ID: ${existing.id}`);
    } else {
      const created = await prisma.tag.create({ data: { name } });
      tagMap.set(name, created.id);
      console.log(`创建标签 "${name}"，ID: ${created.id}`);
    }
  }

  // 4. 创建 ProblemTag 关联（跳过已存在的）
  let created = 0;
  let skipped = 0;

  for (const problem of problems) {
    const tags = problem.tags as string[] | null;
    if (!Array.isArray(tags)) continue;

    for (const tagName of tags) {
      const tagId = tagMap.get(tagName);
      if (!tagId) continue;

      const existing = await prisma.problemTag.findUnique({
        where: { problemId_tagId: { problemId: problem.id, tagId } },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.problemTag.create({
          data: { problemId: problem.id, tagId },
        });
        created++;
      }
    }
  }

  console.log(`\n迁移完成！`);
  console.log(`- 创建 ProblemTag 关联: ${created}`);
  console.log(`- 跳过已存在关联: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
