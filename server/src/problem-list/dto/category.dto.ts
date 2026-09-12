import { Type, Transform } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

class CategoryOptionsDto {
  // `description` is nullable in the database so an update can clear it with null.
  // ValidateIf keeps omitted values optional while still validating non-null input.
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsString() @MaxLength(300)
  description?: string | null;

  // These columns are non-nullable. IsOptional would silently accept null and
  // defer the failure to Prisma as an internal server error.
  @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(0) @Max(1000000)
  sortOrder?: number;

  @ValidateIf((_, value) => value !== undefined) @IsBoolean()
  enabled?: boolean;
}

export class CategoryFieldsDto extends CategoryOptionsDto {
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(60)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  name?: string;
}

export class CreateCategoryDto extends CategoryOptionsDto {
  @IsString() @MinLength(1) @MaxLength(60)
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  name: string;

  @IsOptional() @IsInt() @Min(1)
  parentId?: number;
}

export class CategoryListsDto {
  @IsArray() @ArrayUnique() @ArrayMaxSize(1000) @IsInt({ each: true }) @Min(1, { each: true })
  listIds: number[];
}

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsOptional() @IsString() @MaxLength(200)
  keyword?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @Transform(({ value }) => value === true || value === "true" ? true : value === false || value === "false" ? false : value) @IsBoolean()
  uncategorized?: boolean;
}
