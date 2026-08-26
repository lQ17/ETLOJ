import {
  IsOptional,
  IsString,
  IsEmail,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7_000_000)
  @Matches(
    /^(?:data:image\/(jpeg|jpg|png|webp);base64,|\/api\/avatars\/|https?:\/\/)/,
    {
      message: '头像必须是 JPG、PNG 或 WebP 图片',
    },
  )
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  signature?: string;
}
