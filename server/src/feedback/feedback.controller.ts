import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { PreviewSummaryQueryDto } from './dto/preview-summary.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  /** 公开：扫码 / 短码详情（无鉴权）—— 必须在 :id 之前 */
  @Get('public/:token')
  getPublic(@Param('token') token: string) {
    return this.feedbackService.findByPublicToken(token);
  }

  /** 公开：查看某题在本反馈时间窗内的全部提交（含代码，倒序） */
  @Get('public/:token/problems/:problemId/submissions')
  getPublicProblemSubmissions(
    @Param('token') token: string,
    @Param('problemId', ParseIntPipe) problemId: number,
  ) {
    return this.feedbackService.getPublicProblemSubmissions(token, problemId);
  }

  /** 公开：当前海报 Logo（data URL），无则 null */
  @Get('logo')
  async getLogo() {
    const logoUrl = await this.feedbackService.getLogoUrl();
    return { logoUrl };
  }

  /** 管理端：上传/替换海报 Logo（Base64 data URL） */
  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  setLogo(@Body('logo') logo: string) {
    if (!logo || typeof logo !== 'string') {
      throw new BadRequestException('请提供 logo 字段（图片 data URL）');
    }
    return this.feedbackService.setLogoUrl(logo);
  }

  /** 管理端：清除自定义 Logo，恢复默认 OJ 字标 */
  @Delete('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  clearLogo() {
    return this.feedbackService.clearLogo();
  }

  /** 管理端：时间窗做题汇总 */
  @Get('preview-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  previewSummary(@Query() query: PreviewSummaryQueryDto) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('时间格式无效');
    }
    return this.feedbackService.previewSummary(query.userId, start, end);
  }

  /** 管理端：列表（ADMIN 看全部，TEACHER 看自己创建的） */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  list(
    @CurrentUser() user: { id: number; role: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.feedbackService.listForAdmin(
      user,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }

  /** 管理端：详情 */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.feedbackService.findOneForAdmin(id, user);
  }

  /** 管理端：创建反馈快照 */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  create(
    @CurrentUser('id') creatorId: number,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(creatorId, dto);
  }

  /** 管理端：删除（创建者或 ADMIN） */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.feedbackService.remove(id, user);
  }
}
