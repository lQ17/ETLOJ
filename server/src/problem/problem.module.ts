import { Module } from "@nestjs/common";
import { ProblemService } from "./problem.service";
import { ProblemImportExportService } from "./problem-import-export.service";
import { ProblemController } from "./problem.controller";

@Module({
  controllers: [ProblemController],
  providers: [ProblemService, ProblemImportExportService],
  exports: [ProblemService, ProblemImportExportService],
})
export class ProblemModule {}
