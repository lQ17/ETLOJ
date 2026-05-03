import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { ProblemService } from "./problem.service";
import { CreateProblemDto } from "./dto/create-problem.dto";
import { UpdateProblemDto } from "./dto/update-problem.dto";
import { QueryProblemDto } from "./dto/query-problem.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("problems")
export class ProblemController {
  constructor(private problemService: ProblemService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  create(@Body() dto: CreateProblemDto) {
    return this.problemService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryProblemDto) {
    return this.problemService.findAll(query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.problemService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProblemDto) {
    return this.problemService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  delete(@Param("id", ParseIntPipe) id: number) {
    return this.problemService.delete(id);
  }

  @Get(":id/testcases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  getTestcases(@Param("id", ParseIntPipe) id: number) {
    return this.problemService.findOne(id).then((p) =>
      this.problemService.getTestcases(p.slug)
    );
  }

  @Post(":id/testcases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  saveTestcases(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { testcases: { input: string; output: string }[] },
  ) {
    return this.problemService.saveTestcases(id, body.testcases);
  }
}
