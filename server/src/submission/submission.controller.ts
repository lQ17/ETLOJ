import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe, Headers, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubmissionService } from "./submission.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { QuerySubmissionDto } from "./dto/query-submission.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("submissions")
export class SubmissionController {
  private judgeSecret: string;

  constructor(
    private submissionService: SubmissionService,
    private config: ConfigService,
  ) {
    const secret = this.config.get<string>("JUDGE_SECRET");
    if (!secret) {
      throw new Error("缺少必要的环境变量 JUDGE_SECRET，请在 .env 中配置");
    }
    this.judgeSecret = secret;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser("id") userId: number,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionService.create(userId, dto);
  }

  @Post("run")
  @UseGuards(JwtAuthGuard)
  run(
    @CurrentUser("id") userId: number,
    @Body() body: { code: string; language: string; input: string; problemId: number },
  ) {
    return this.submissionService.run(userId, body);
  }

  @Post("callback")
  async callback(
    @Headers("x-judge-secret") secret: string,
    @Body() body: { submissionId: number; status: string; timeUsed: number; memoryUsed: number; score?: number },
  ) {
    if (secret !== this.judgeSecret) {
      throw new UnauthorizedException("无效的评测机密钥");
    }
    return this.submissionService.updateResult(body.submissionId, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QuerySubmissionDto) {
    return this.submissionService.findAll(query);
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  findMy(
    @CurrentUser("id") userId: number,
    @Query() query: QuerySubmissionDto,
  ) {
    query.userId = userId;
    return this.submissionService.findAll(query);
  }

  @Delete("dirty")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  cleanDirty() {
    return this.submissionService.cleanDirty();
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  getProblemsStatus(
    @CurrentUser("id") userId: number,
    @Query("problemIds") problemIds: string,
  ) {
    const ids = problemIds ? problemIds.split(",").map(Number).filter((n) => !isNaN(n)) : [];
    return this.submissionService.getProblemsStatus(userId, ids);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.submissionService.findOne(id, user.id, user.role);
  }
}
