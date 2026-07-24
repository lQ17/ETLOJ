import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 单题快照（创建时由前端传入，或由服务端根据 problemIds 重算） */
export class FeedbackItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  problemId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  difficulty: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  score?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  submitCount: number;
}

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId: number;

  /** 勾选后的题目快照（优先使用） */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeedbackItemDto)
  items?: FeedbackItemDto[];

  /** 若未传 items，可用 problemIds + 时间窗由服务端汇总生成 */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  problemIds?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** 海报右上角显示日期 YYYY-MM-DD（与做题查询范围独立） */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  displayDate?: string;

  /** 做题记录查询起始（含） */
  @IsOptional()
  @IsDateString()
  rangeStart?: string;

  /** 做题记录查询结束（含） */
  @IsOptional()
  @IsDateString()
  rangeEnd?: string;
}
