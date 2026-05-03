import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req
} from "@nestjs/common";
import { ProblemService } from "./problem.service";
import { CreateProblemDto } from "./dto/create-problem.dto";
import { UpdateProblemDto } from "./dto/update-problem.dto";
import { QueryProblemDto } from "./dto/query-problem.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

function parseIdOrSlug(id: string): number | string {
  const num = Number(id);
  return Number.isNaN(num) ? id : num;
}

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
  findAll(@Query() query: QueryProblemDto, @Req() req: any) {
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "TEACHER";
    return this.problemService.findAll(query, isAdmin);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string, @Req() req: any) {
    const isAdmin = req.user.role === "ADMIN" || req.user.role === "TEACHER";
    return this.problemService.findOne(parseIdOrSlug(id), isAdmin);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  update(@Param("id") id: string, @Body() dto: UpdateProblemDto) {
    return this.problemService.update(parseIdOrSlug(id), dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  delete(@Param("id") id: string) {
    return this.problemService.delete(parseIdOrSlug(id));
  }

  @Get(":id/testcases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  getTestcases(@Param("id") id: string) {
    return this.problemService.findOne(parseIdOrSlug(id)).then((p) =>
      this.problemService.getTestcases(p.slug)
    );
  }

  @Post(":id/testcases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  saveTestcases(
    @Param("id") id: string,
    @Body() body: { testcases: { input: string; output: string }[] },
  ) {
    return this.problemService.saveTestcases(parseIdOrSlug(id), body.testcases);
  }
}
