import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { TagService } from "./tag.service";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("tags")
export class TagController {
  constructor(private tagService: TagService) {}

  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tagService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  create(@Body() dto: CreateTagDto) {
    return this.tagService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.tagService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "TEACHER")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.tagService.remove(id);
  }
}
