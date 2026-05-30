import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe, ForbiddenException,
} from "@nestjs/common";
import { ProblemListService } from "./problem-list.service";
import { CreateProblemListDto } from "./dto/create-problem-list.dto";
import { UpdateProblemListDto } from "./dto/update-problem-list.dto";
import { UpdateItemsDto } from "./dto/update-items.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtGuard } from "../auth/optional-jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("problem-lists")
export class ProblemListController {
  constructor(
    private problemListService: ProblemListService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  findAllPublic(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("keyword") keyword?: string,
    @CurrentUser("id") userId?: number,
  ) {
    return this.problemListService.findAllPublic(
      Number(page) || 1,
      Number(pageSize) || 20,
      keyword,
      userId,
    );
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  findMine(
    @CurrentUser("id") userId: number,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.problemListService.findAllByUser(
      userId,
      Number(page) || 1,
      Number(pageSize) || 20,
    );
  }

  @Get(":id")
  @UseGuards(OptionalJwtGuard)
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user?: { id: number; role: string },
  ) {
    return this.problemListService.findOne(id, user?.id, user?.role);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser("id") userId: number,
    @Body() dto: CreateProblemListDto,
  ) {
    return this.problemListService.create(userId, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
    @Body() dto: UpdateProblemListDto,
  ) {
    return this.problemListService.update(id, user.id, user.role, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  delete(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; role: string },
  ) {
    return this.problemListService.delete(id, user.id, user.role);
  }

  /**
   * 校验当前用户是否有权操作题单：
   * - 私有题单：仅创建者或 ADMIN/TEACHER 可操作
   * - 公共题单：仅 ADMIN/TEACHER 可操作
   */
  private async assertUserCanModify(
    listId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    const list = await this.prisma.problemList.findUnique({
      where: { id: listId },
      select: { isPublic: true, creatorId: true },
    });
    if (!list) {
      throw new ForbiddenException("题单不存在");
    }
    const isAdminOrTeacher = userRole === "ADMIN" || userRole === "TEACHER";
    if (list.isPublic) {
      // 公共题单仅管理员/教师可操作
      if (!isAdminOrTeacher) {
        throw new ForbiddenException("无权操作公共题单");
      }
    } else {
      // 私有题单仅创建者或管理员/教师可操作
      if (list.creatorId !== userId && !isAdminOrTeacher) {
        throw new ForbiddenException("无权操作该私有题单");
      }
    }
  }

  @Post(":id/items")
  @UseGuards(JwtAuthGuard)
  async addItems(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
    @CurrentUser("role") userRole: string,
    @Body() body: { slugs: string[] },
  ) {
    await this.assertUserCanModify(id, userId, userRole);
    return this.problemListService.addItems(id, body.slugs);
  }

  @Delete(":id/items/:problemId")
  @UseGuards(JwtAuthGuard)
  async removeItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("problemId", ParseIntPipe) problemId: number,
    @CurrentUser("id") userId: number,
    @CurrentUser("role") userRole: string,
  ) {
    await this.assertUserCanModify(id, userId, userRole);
    return this.problemListService.removeItem(id, problemId);
  }

  @Patch(":id/items/sort")
  @UseGuards(JwtAuthGuard)
  async updateSortOrder(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
    @CurrentUser("role") userRole: string,
    @Body() dto: UpdateItemsDto,
  ) {
    await this.assertUserCanModify(id, userId, userRole);
    return this.problemListService.updateSortOrder(id, dto.items);
  }
}
