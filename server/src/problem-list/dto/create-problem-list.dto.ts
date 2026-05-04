import { IsString, IsOptional, IsBoolean } from "class-validator";

export class CreateProblemListDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
