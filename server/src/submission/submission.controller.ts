import {
  Controller, Get, Post,
  Body, Param, Query, UseGuards, ParseIntPipe, Headers,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubmissionService } from "./submission.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { QuerySubmissionDto } from "./dto/query-submission.dto";
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

  @Post("run")
  @UseGuards(JwtAuthGuard)
  run(
    @CurrentUser("id") userId: number,
    @Body() body: { code: string; language: string; input: string; problemId: number },
  ) {
    return this.submissionService.run(userId, body);
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

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.submissionService.findOne(id, user.id, user.role);
  }

  @Post("callback")
  async callback(
    @Headers("x-judge-secret") secret: string,
    @Body() body: { submissionId: number; status: string; timeUsed: number; memoryUsed: number; score?: number },
  ) {
    if (secret !== this.judgeSecret) {
      return { error: "unauthorized" };
    }
    return this.submissionService.updateResult(body.submissionId, body);
  }
}
