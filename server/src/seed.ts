import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log('Admin user already exists, skipping.');
    return;
  }

  // 优先从环境变量读取，未配置则生成随机密码
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const hashed = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@etloj.local",
      password: hashed,
      role: "ADMIN",
    },
  });
  console.log(`Admin user created: id=${admin.id}, username=${admin.username}`);
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.log(`随机生成的管理员密码: ${adminPassword}，请妥善保管`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
