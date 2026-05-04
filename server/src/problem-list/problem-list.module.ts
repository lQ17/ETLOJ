import { Module } from "@nestjs/common";
import { ProblemListController } from "./problem-list.controller";
import { ProblemListService } from "./problem-list.service";

@Module({
  controllers: [ProblemListController],
  providers: [ProblemListService],
  exports: [ProblemListService],
})
export class ProblemListModule {}
