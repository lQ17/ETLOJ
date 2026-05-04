import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RankingService } from "./ranking.service";
import { QueryRankingDto } from "./dto/query-ranking.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("ranking")
export class RankingController {
  constructor(private rankingService: RankingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getRanking(@Query() query: QueryRankingDto) {
    return this.rankingService.getRanking(query);
  }
}
