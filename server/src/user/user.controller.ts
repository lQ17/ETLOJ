import { Controller, Post, Get, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { QueryUserDto } from "./dto/query-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  @Roles("ADMIN")
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto.username, dto.email, dto.phone, dto.password, dto.role);
  }

  @Get()
  @Roles("ADMIN")
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(":id")
  @Roles("ADMIN")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.userService.delete(id);
  }

  @Patch(":id/toggle-active")
  @Roles("ADMIN")
  toggleActive(@Param("id", ParseIntPipe) id: number) {
    return this.userService.toggleActive(id);
  }
}
