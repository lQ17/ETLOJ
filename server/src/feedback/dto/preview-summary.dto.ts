import { IsDateString, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewSummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;

  @IsDateString()
  @IsNotEmpty()
  start: string;

  @IsDateString()
  @IsNotEmpty()
  end: string;
}
