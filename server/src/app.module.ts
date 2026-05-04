import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { ProblemModule } from "./problem/problem.module";
import { SubmissionModule } from "./submission/submission.module";
import { RankingModule } from "./ranking/ranking.module";
import { ProblemListModule } from "./problem-list/problem-list.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    ProblemModule,
    SubmissionModule,
    RankingModule,
    ProblemListModule,
  ],
})
export class AppModule {}
