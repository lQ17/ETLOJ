import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RankingService } from "./ranking.service";
import { QueryRankingDto } from "./dto/query-ranking.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("ranking")
export class RankingController {
  constructor(private rankingService: RankingService) {}

  /** 按用户名关键字搜索（须在 :id 等动态路由之前，若后续新增） */
  @Get("search")
  @UseGuards(JwtAuthGuard)
  searchUsers(@Query("keyword") keyword: string) {
    return this.rankingService.searchUsers(keyword || "");
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getRanking(@Query() query: QueryRankingDto) {
    return this.rankingService.getRanking(query);
  }
}
