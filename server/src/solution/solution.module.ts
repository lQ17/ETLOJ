import { Module } from "@nestjs/common";
import { SolutionController } from "./solution.controller";
import { SolutionService } from "./solution.service";

@Module({
  controllers: [SolutionController],
  providers: [SolutionService],
  exports: [SolutionService],
})
export class SolutionModule {}
