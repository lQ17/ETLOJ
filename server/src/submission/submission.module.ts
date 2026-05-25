import { Module } from "@nestjs/common";
import { SubmissionService } from "./submission.service";
import { SubmissionController } from "./submission.controller";
import { SubmissionGateway } from "./submission.gateway";
import { ProblemModule } from "../problem/problem.module";

@Module({
  imports: [ProblemModule],
  controllers: [SubmissionController],
  providers: [SubmissionService, SubmissionGateway],
  exports: [SubmissionService, SubmissionGateway],
})
export class SubmissionModule {}
