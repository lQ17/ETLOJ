import { IsOptional, IsString, IsIn, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class QueryUserDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(["USER", "ADMIN", "TEACHER"])
  role?: "USER" | "ADMIN" | "TEACHER";

  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: "PENDING" | "APPROVED" | "REJECTED";
}
