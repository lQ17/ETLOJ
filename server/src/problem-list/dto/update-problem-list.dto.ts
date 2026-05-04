import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateProblemListDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
