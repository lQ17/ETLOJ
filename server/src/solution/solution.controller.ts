import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { SolutionService } from "./solution.service";
import { CreateSolutionDto } from "./dto/create-solution.dto";
import { UpdateSolutionDto } from "./dto/update-solution.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("solutions")
export class SolutionController {
  constructor(private solutionService: SolutionService) {}

  @Get()
  findByProblem(@Query("problemId", ParseIntPipe) problemId: number) {
    return this.solutionService.findByProblem(problemId);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser("id") userId: number) {
    return this.solutionService.findByAuthor(userId);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.solutionService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser("id") userId: number,
    @Body() dto: CreateSolutionDto,
  ) {
    return this.solutionService.create(userId, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
    @Body() dto: UpdateSolutionDto,
  ) {
    return this.solutionService.update(id, user.id, user.role, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.solutionService.remove(id, user.id, user.role);
  }
}
