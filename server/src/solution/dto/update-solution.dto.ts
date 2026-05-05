import { IsNotEmpty, IsString } from "class-validator";

export class UpdateSolutionDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
