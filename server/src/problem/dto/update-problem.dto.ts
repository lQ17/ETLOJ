import { IsOptional, IsIn, IsInt, IsString, IsArray, Min, Max, IsBoolean } from "class-validator";

export class UpdateProblemDto {
  @IsOptional()
  @IsString()
  title?: string;

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
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  markdown?: string;
}
