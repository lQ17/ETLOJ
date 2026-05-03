import { IsString, IsNotEmpty } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  account: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
