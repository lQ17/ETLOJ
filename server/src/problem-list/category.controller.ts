import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CategoryService } from "./category.service";
import { CategoryFieldsDto, CategoryListsDto, CreateCategoryDto } from "./dto/category.dto";

@Controller("problem-list-categories")
export class CategoryController {
  constructor(private service: CategoryService) {}

  @Get()
  tree() { return this.service.tree(); }

  @Get("manage") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN", "TEACHER")
  manage() { return this.service.tree(true); }

  @Post("initialize") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  initialize() { return this.service.initialize(); }

  @Post() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  create(@Body() dto: CreateCategoryDto) { return this.service.create(dto); }

  @Patch(":id") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: CategoryFieldsDto) { return this.service.update(id, dto); }

  @Get(":id/items") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN", "TEACHER")
  items(@Param("id", ParseIntPipe) id: number) { return this.service.items(id); }

  @Post(":id/items") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN", "TEACHER")
  add(@Param("id", ParseIntPipe) id: number, @Body() dto: CategoryListsDto) { return this.service.add(id, dto.listIds); }

  @Patch(":id/items/sort") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN", "TEACHER")
  sort(@Param("id", ParseIntPipe) id: number, @Body() dto: CategoryListsDto) { return this.service.sort(id, dto.listIds); }

  @Delete(":id/items/:listId") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN", "TEACHER")
  remove(@Param("id", ParseIntPipe) id: number, @Param("listId", ParseIntPipe) listId: number) { return this.service.remove(id, listId); }
}
