import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary: string;

  @IsString()
  @IsOptional()
  content: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED"])
  status?: string;
}
