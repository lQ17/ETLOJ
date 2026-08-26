import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AvatarService } from './avatar.service';

@Controller('avatars')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Get(':userId/:version.webp')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  getAvatar(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('version') version: string,
    @Res() response: Response,
  ) {
    return response.sendFile(this.avatarService.getFilePath(userId, version), {
      headers: { 'Content-Type': 'image/webp' },
    });
  }
}
