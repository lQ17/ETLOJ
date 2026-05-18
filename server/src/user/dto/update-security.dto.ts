import { IsString, MinLength } from "class-validator";

export class UpdateSecurityDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
