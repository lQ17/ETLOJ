import { IsOptional, IsIn, IsString, IsInt, Min, IsDateString } from "class-validator";
import { Type } from "class-transformer";

export class QueryRankingDto {
  @IsOptional()
  @IsIn(["ac", "score"])
  mode?: "ac" | "score" = "ac";

  @IsOptional()
  @IsIn(["all", "6m", "1m", "1w", "yesterday", "today", "custom"])
  range?: string = "all";

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
