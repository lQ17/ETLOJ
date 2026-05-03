import { IsInt, IsString, IsNotEmpty, IsIn, Min } from "class-validator";

export class CreateSubmissionDto {
  @IsInt()
  @Min(1)
  problemId: number;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsIn(["c", "cpp", "java", "python"])
  language: string;
}
