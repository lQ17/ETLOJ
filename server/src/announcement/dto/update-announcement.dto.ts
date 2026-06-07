import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED"])
  status?: string;
}
