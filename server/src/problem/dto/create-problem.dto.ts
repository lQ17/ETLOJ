import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, IsArray, Min, Max } from "class-validator";

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsIn(["EASY", "MEDIUM", "HARD"])
  difficulty?: "EASY" | "MEDIUM" | "HARD";

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
  @Max(100)
  score?: number;

  @IsString()
  @IsNotEmpty()
  markdown: string;
}
