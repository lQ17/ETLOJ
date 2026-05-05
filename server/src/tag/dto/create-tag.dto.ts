import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
