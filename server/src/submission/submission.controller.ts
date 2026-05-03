import {
  Controller, Get, Post,
  Body, Param, Query, UseGuards, ParseIntPipe, Headers,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubmissionService } from "./submission.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("submissions")
export class SubmissionController {
  private judgeSecret: string;

  constructor(
    private submissionService: SubmissionService,
    private config: ConfigService,
  ) {
    this.judgeSecret = this.config.get("JUDGE_SECRET") || "judge-callback-secret";
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser("id") userId: number,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("userId") userId?: string,
    @Query("problemId") problemId?: string,
  ) {
    return this.submissionService.findAll(
      userId ? +userId : undefined,
      problemId ? +problemId : undefined,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  findMy(
    @CurrentUser("id") userId: number,
    @Query("page") page?: string,
    @Query("problemId") problemId?: string,
  ) {
    return this.submissionService.findAll(
      userId,
      problemId ? +problemId : undefined,
      page ? +page : 1,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.submissionService.findOne(id);
  }

  // Judge 服务回调，更新判题结果
  @Post("callback")
  async callback(
    @Headers("x-judge-secret") secret: string,
    @Body() body: { submissionId: number; status: string; timeUsed: number; memoryUsed: number },
  ) {
    if (secret !== this.judgeSecret) {
      return { error: "unauthorized" };
    }
    return this.submissionService.updateResult(body.submissionId, body);
  }
}
