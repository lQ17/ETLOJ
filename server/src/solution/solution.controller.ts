import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { SolutionService } from "./solution.service";
import { CreateSolutionDto } from "./dto/create-solution.dto";
import { UpdateSolutionDto } from "./dto/update-solution.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
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

  @Get("pending")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  findPending() {
    return this.solutionService.findPending();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  findAllForAdmin(
    @Query("problemId") problemId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.solutionService.findAllForAdmin(
      problemId ? +problemId : undefined,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
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

  @Patch(":id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  approve(@Param("id", ParseIntPipe) id: number) {
    return this.solutionService.approve(id);
  }

  @Patch(":id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  reject(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
  ) {
    return this.solutionService.reject(id, reason);
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
