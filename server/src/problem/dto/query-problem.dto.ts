import { IsOptional, IsIn, IsString, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class QueryProblemDto {
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

  @IsOptional()
  @IsIn(["EASY", "MEDIUM", "HARD"])
  difficulty?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
