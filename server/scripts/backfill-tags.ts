import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill...');
  const users = await prisma.user.findMany();

  for (const user of users) {
    const acProblems = await prisma.$queryRaw<Array<{ problem_id: number; tags: string }>>`
      SELECT DISTINCT s.problem_id, p.tags
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ${user.id} AND s.status = 'AC'
    `;

    for (const prob of acProblems) {
      if (prob.tags) {
        let tagsArr: string[] = [];
        try {
          tagsArr = typeof prob.tags === 'string' ? JSON.parse(prob.tags) : prob.tags;
        } catch(e) {}

        if (Array.isArray(tagsArr)) {
          for (const tag of tagsArr) {
            await prisma.$executeRaw`
              INSERT INTO user_tag_records (user_id, tag, count, created_at, updated_at)
              VALUES (${user.id}, ${tag}, 1, NOW(), NOW())
              ON DUPLICATE KEY UPDATE count = count + 1, updated_at = NOW()
            `;
          }
        }
      }
    }
  }
  console.log('Backfill completed.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
