import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req, Res,
  ConflictException, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProblemService } from "./problem.service";
import { CreateProblemDto } from "./dto/create-problem.dto";
import { UpdateProblemDto } from "./dto/update-problem.dto";
import { QueryProblemDto } from "./dto/query-problem.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtGuard } from "../auth/optional-jwt.guard";
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
  @UseGuards(OptionalJwtGuard)
  findAll(@Query() query: QueryProblemDto, @Req() req: any) {
    const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "TEACHER";
    return this.problemService.findAll(query, isAdmin);
  }

  @Post("export")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  async exportProblems(@Body() body: { slugs: string[] }, @Res() res: any) {
    if (!body.slugs || body.slugs.length === 0) {
      throw new ConflictException("请选择要导出的题目");
    }
    const buffer = await this.problemService.exportProblems(body.slugs);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="problems-export.zip"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post("export-all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  async exportAllProblems(@Res() res: any) {
    const buffer = await this.problemService.exportAllProblems();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="problems-export.zip"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post("import")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async importProblems(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new ConflictException("请上传 zip 文件");
    return this.problemService.importProblems(file.buffer);
  }

  @Get(":id")
  @UseGuards(OptionalJwtGuard)
  findOne(@Param("id") id: string, @Req() req: any) {
    const isAdmin = req.user?.role === "ADMIN" || req.user?.role === "TEACHER";
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

  @Get(":id/markdown")
  @UseGuards(OptionalJwtGuard)
  getMarkdown(@Param("id") id: string) {
    return this.problemService.getMarkdown(parseIdOrSlug(id));
  }

  @Get(":id/testcases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  getTestcases(@Param("id") id: string) {
    return this.problemService.findOne(parseIdOrSlug(id), true).then((p) =>
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
