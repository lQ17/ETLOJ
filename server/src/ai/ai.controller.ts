import {
  Controller, Post, Get, Patch, Delete,
  Body, Query, Res, UseGuards, ParseIntPipe, Param
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

  /** 获取公开 AI 统计 */
  @Get('stats/public')
  getPublicStats() {
    return this.aiService.getStats();
  }

  /** 流式聊天 */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: { id: number; role: string },
    @Res() res: Response,
  ) {
    // 兼容 AI SDK v3 的 parts 格式
    for (const msg of dto.messages) {
      if (!msg.content && msg.parts) {
        msg.content = msg.parts
          .filter(p => p.type === 'text' && p.text)
          .map(p => p.text)
          .join('');
      }
    }
    // 验证 content 不为空且不超长
    for (const msg of dto.messages) {
      if (!msg.content) {
        res.status(400).json({ message: '消息内容不能为空' });
        return;
      }
      if (msg.content.length > 5000) {
        res.status(400).json({ message: '单条消息内容不能超过 5000 个字符' });
        return;
      }
    }
    try {
      await this.aiService.chat(user, dto, res);
    } catch (err: any) {
      if (!res.headersSent) {
        const status = err.getStatus?.() || err.status || 500;
        // 只返回通用错误消息，不暴露外部服务细节
        res.status(status).json({ message: 'AI 服务出错，请稍后重试' });
      }
    }
  }

  /** 获取某个题目的聊天记录 */
  @Get('chat/history')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @Query('problemId', ParseIntPipe) problemId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.getHistory(user.id, problemId);
  }

  /** 清空某个题目的聊天记录 */
  @Delete('chat/history')
  @UseGuards(JwtAuthGuard)
  clearHistory(
    @Query('problemId', ParseIntPipe) problemId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.aiService.clearHistory(user.id, problemId);
  }

  /** 获取当前用户剩余使用次数 */
  @Get('remaining')
  @UseGuards(JwtAuthGuard)
  getRemainingUses(@CurrentUser() user: { id: number; role: string }) {
    return this.aiService.getRemainingUses(user.id, user.role);
  }

  // ─── ADMIN ROUTES ───

  @Get('admin/providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getProviders() {
    return this.aiService.getProviders();
  }

  @Post('admin/providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  addProvider(@Body() dto: any) {
    return this.aiService.addProvider(dto);
  }

  @Patch('admin/providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateProvider(@Body() dto: any, @Param('id', ParseIntPipe) id: number) {
    return this.aiService.updateProvider(id, dto);
  }

  @Delete('admin/providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deleteProvider(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.deleteProvider(id);
  }

  @Post('admin/providers/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  activateProvider(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.activateProvider(id);
  }

  @Post('admin/providers/fetch-models')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  fetchAvailableModels(@Body() dto: { apiBase: string; apiKey: string }) {
    return this.aiService.fetchAvailableModels(dto.apiBase, dto.apiKey);
  }

  @Get('admin/users/quotas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getUsersQuotas(@Query('page') page: string, @Query('pageSize') pageSize: string, @Query('username') username: string) {
    return this.aiService.getUsersQuotas(Number(page) || 1, Number(pageSize) || 20, username);
  }

  @Patch('admin/users/:id/quota')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateUserQuota(@Param('id', ParseIntPipe) id: number, @Body('aiDailyLimit') aiDailyLimit: number | null) {
    return this.aiService.updateUserQuota(id, aiDailyLimit);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getStats() {
    return this.aiService.getStats();
  }

  @Get('admin/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getUsageLogs(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.aiService.getUsageLogs(Number(page) || 1, Number(pageSize) || 20, { provider, model, startDate, endDate });
  }

  @Patch('admin/config/global-limit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  setGlobalLimit(@Body('dailyLimit') dailyLimit: number) {
    return this.aiService.setGlobalLimit(dailyLimit);
  }
}
