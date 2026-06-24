import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, IsOptional } from "class-validator";

export class ReapplyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken: string;
}
