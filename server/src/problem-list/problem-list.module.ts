import { Module } from "@nestjs/common";
import { ProblemListController } from "./problem-list.controller";
import { ProblemListService } from "./problem-list.service";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";

@Module({
  controllers: [ProblemListController, CategoryController],
  providers: [ProblemListService, CategoryService],
  exports: [ProblemListService],
})
export class ProblemListModule {}
