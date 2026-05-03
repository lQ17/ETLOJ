import { IsString, IsEmail, IsOptional, IsIn, IsBoolean } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsIn(["USER", "ADMIN", "TEACHER"])
  role?: "USER" | "ADMIN" | "TEACHER";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
