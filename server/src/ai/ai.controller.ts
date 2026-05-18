import {
  Controller, Post, Get, Patch,
  Body, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  /** 流式聊天 */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() dto: any,
    @CurrentUser() user: { id: number; role: string },
    @Res() res: Response,
  ) {
    try {
      await this.aiService.chat(user, dto, res);
    } catch (err: any) {
      if (!res.headersSent) {
        const status = err.getStatus?.() || err.status || 500;
        const message = err.response?.message || err.message || 'AI 服务出错';
        res.status(status).json({ message });
      }
    }
  }

  /** 获取当前用户剩余使用次数 */
  @Get('remaining')
  @UseGuards(JwtAuthGuard)
  getRemainingUses(@CurrentUser() user: { id: number; role: string }) {
    return this.aiService.getRemainingUses(user.id, user.role);
  }

  /** 获取 AI 配置（管理员） */
  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getConfig() {
    return this.aiService.getAiConfig();
  }

  /** 更新 AI 配置（管理员） */
  @Patch('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateConfig(
    @Body() dto: { apiBase?: string; apiKey?: string; model?: string; dailyLimit?: number },
  ) {
    return this.aiService.updateAiConfig(dto);
  }
}
