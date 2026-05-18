import { IsInt, IsOptional, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatDto {
  @IsArray()
  messages: { role: string; content: string }[];

  @IsInt()
  @Type(() => Number)
  problemId: number;

  @IsOptional()
  @IsString()
  currentCode?: string;
}
