import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, IsArray, Min, Max } from "class-validator";
import { DIFFICULTY_VALUES, MAX_SCORE } from "../difficulty.constants";
import type { DifficultyLevel } from "../difficulty.constants";

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsIn([...DIFFICULTY_VALUES])
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(1024)
  memoryLimit?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];

  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SCORE)
  score?: number;

  @IsString()
  @IsNotEmpty()
  markdown: string;
}
