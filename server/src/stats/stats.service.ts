import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [problemCount, submissionCount, userCount] = await Promise.all([
      this.prisma.problem.count({ where: { isPublic: true } }),
      this.prisma.submission.count(),
      this.prisma.user.count(),
    ]);
    return { problemCount, submissionCount, userCount };
  }
}
