import { IsInt, IsOptional, IsString, IsArray, IsNotEmpty, ValidateNested, ArrayMaxSize, MaxLength, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/** 单条消息 DTO，防止恶意超长内容 */
class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '单条消息内容不能超过 5000 个字符' })
  content?: string;

  /** AI SDK v3 使用 parts 格式 */
  @IsOptional()
  @IsArray()
  parts?: Array<{ type: string; text?: string }>;
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(20, { message: '消息数组不能超过 20 条' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsInt()
  @Type(() => Number)
  problemId: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '当前代码不能超过 5000 个字符' })
  currentCode?: string;

  /** 学生当前编辑器语言，需声明否则会被 ValidationPipe whitelist 丢弃 */
  @IsOptional()
  @IsString()
  @IsIn(['c', 'cpp', 'java', 'python'], { message: '不支持的编程语言' })
  language?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  promptConfigId?: number;

  /** 重新生成上一轮助手回复：不追加 user，并删除末尾 assistant */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  regenerate?: boolean;
}
