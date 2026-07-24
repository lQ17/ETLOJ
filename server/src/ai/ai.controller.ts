import {
  Controller, Post, Get, Patch, Delete,
  Body, Query, Res, Req, UseGuards, ParseIntPipe, Param
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
    @Req() req: Request,
  ) {
    // 统一从 content / parts 提取文本并限长（AI SDK v3 走 parts）
    const extractText = (msg: { content?: string; parts?: Array<{ type: string; text?: string }> }) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        const fromParts = msg.parts
          .filter((p) => p.type === 'text' && p.text)
          .map((p) => p.text as string)
          .join('');
        if (fromParts) return fromParts;
      }
      return msg.content || '';
    };

    // regenerate 时前端可能带上空的 assistant 占位，且服务端以 DB 历史为准
    for (const msg of dto.messages || []) {
      const text = extractText(msg);
      if (!text.trim()) {
        if (dto.regenerate || msg.role === 'assistant') {
          msg.content = '';
          continue;
        }
        res.status(400).json({ message: '消息内容不能为空' });
        return;
      }
      if (text.length > 5000) {
        res.status(400).json({ message: '单条消息内容不能超过 5000 个字符' });
        return;
      }
      // 规范化为 content，后续服务层可直接使用
      msg.content = text.slice(0, 5000);
    }
    try {
      await this.aiService.chat(user, dto, res, req);
    } catch (err: any) {
      if (!res.headersSent) {
        const status = err.getStatus?.() || err.status || 500;
        // 额度超限等业务错误透传 message；其余返回通用文案，不暴露外部服务细节
        const isClientError = status >= 400 && status < 500;
        let message = 'AI 服务出错，请稍后重试';
        if (isClientError) {
          const raw = err.getResponse?.() ?? err.message;
          if (typeof raw === 'string') message = raw;
          else if (raw?.message) message = Array.isArray(raw.message) ? raw.message[0] : raw.message;
        }
        res.status(status).json({ message });
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

  @Get('admin/prompt-configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getPromptConfigs() {
    return this.aiService.getPromptConfigs();
  }

  @Post('admin/prompt-configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  addPromptConfig(@Body() dto: { name: string; role: string; codeRules: string; replyRules: string; isActive?: boolean }) {
    return this.aiService.addPromptConfig(dto);
  }

  @Patch('admin/prompt-configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updatePromptConfig(@Body() dto: any, @Param('id', ParseIntPipe) id: number) {
    return this.aiService.updatePromptConfig(id, dto);
  }

  @Delete('admin/prompt-configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deletePromptConfig(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.deletePromptConfig(id);
  }

  @Post('admin/prompt-configs/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  activatePromptConfig(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.activatePromptConfig(id);
  }

  @Get('prompt-configs')
  @UseGuards(JwtAuthGuard)
  getPublicPromptConfigs() {
    return this.aiService.getPublicPromptConfigs();
  }
}
