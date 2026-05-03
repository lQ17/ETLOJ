import { IsOptional, IsString, IsIn, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class QuerySubmissionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  problemId?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(["PENDING", "JUDGING", "AC", "WA", "TLE", "MLE", "RE", "CE", "SE"])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}
