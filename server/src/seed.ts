import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log('Admin user already exists, skipping.');
    return;
  }

  const hashed = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@etloj.local",
      password: hashed,
      role: "ADMIN",
    },
  });
  console.log(`Admin user created: id=${admin.id}, username=${admin.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
