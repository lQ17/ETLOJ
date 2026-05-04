import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { ProblemListService } from "./problem-list.service";
import { CreateProblemListDto } from "./dto/create-problem-list.dto";
import { UpdateProblemListDto } from "./dto/update-problem-list.dto";
import { UpdateItemsDto } from "./dto/update-items.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtGuard } from "../auth/optional-jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("problem-lists")
export class ProblemListController {
  constructor(private problemListService: ProblemListService) {}

  @Get()
  findAllPublic(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("keyword") keyword?: string,
  ) {
    return this.problemListService.findAllPublic(
      Number(page) || 1,
      Number(pageSize) || 20,
      keyword,
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

  @Post(":id/items")
  @UseGuards(JwtAuthGuard)
  addItems(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { slugs: string[] },
  ) {
    return this.problemListService.addItems(id, body.slugs);
  }

  @Delete(":id/items/:problemId")
  @UseGuards(JwtAuthGuard)
  removeItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("problemId", ParseIntPipe) problemId: number,
  ) {
    return this.problemListService.removeItem(id, problemId);
  }

  @Patch(":id/items/sort")
  @UseGuards(JwtAuthGuard)
  updateSortOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateItemsDto,
  ) {
    return this.problemListService.updateSortOrder(id, dto.items);
  }
}
