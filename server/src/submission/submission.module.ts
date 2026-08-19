import { Module } from "@nestjs/common";
import { SubmissionService } from "./submission.service";
import { SubmissionController } from "./submission.controller";
import { SubmissionGateway } from "./submission.gateway";
import { ProblemModule } from "../problem/problem.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ProblemModule, AuthModule],
  controllers: [SubmissionController],
  providers: [SubmissionService, SubmissionGateway],
  exports: [SubmissionService, SubmissionGateway],
})
export class SubmissionModule {}
