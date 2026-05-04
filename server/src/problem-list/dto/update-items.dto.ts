import { IsArray, ValidateNested, IsInt } from "class-validator";
import { Type } from "class-transformer";

class SortItem {
  @IsInt()
  id: number;

  @IsInt()
  sortOrder: number;
}

export class UpdateItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortItem)
  items: SortItem[];
}
