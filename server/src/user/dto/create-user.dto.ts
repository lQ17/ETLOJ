import { IsString, IsEmail, IsNotEmpty, IsOptional, IsIn } from "class-validator";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsIn(["USER", "ADMIN", "TEACHER"])
  role?: "USER" | "ADMIN" | "TEACHER";
}
