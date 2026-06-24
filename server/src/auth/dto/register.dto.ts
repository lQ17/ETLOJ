import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength, IsOptional } from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  remark?: string;

  @IsString()
  @IsNotEmpty()
  turnstileToken: string;
}
