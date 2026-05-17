import { IsOptional, IsIn, IsString, IsInt, IsArray, Min } from "class-validator";
import { Type, Transform } from "class-transformer";
import { DIFFICULTY_VALUES } from "../difficulty.constants";

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
  @IsIn([...DIFFICULTY_VALUES])
  difficulty?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(["AND", "OR"])
  tagMode?: "AND" | "OR";
}
