import { Controller, Post, Get, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards, Req } from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { QueryUserDto } from "./dto/query-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSecurityDto } from "./dto/update-security.dto";
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
  @Roles("ADMIN", "TEACHER")
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  // ---- "me" routes MUST come before ":id" routes ----
  @Patch("me/profile")
  updateMyProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.id, {
      email: body.email,
      phone: body.phone,
      avatar: body.avatar,
      signature: body.signature,
    });
  }

  @Patch("me/security")
  updateMySecurity(@Req() req: any, @Body() body: UpdateSecurityDto) {
    return this.userService.updatePassword(req.user.id, body.oldPassword, body.newPassword);
  }

  // ---- parameterized ":id" routes come after ----
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

  @Patch(":id/status")
  @Roles("ADMIN", "TEACHER")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status: "PENDING" | "APPROVED" | "REJECTED"; rejectReason?: string }
  ) {
    return this.userService.updateStatus(id, body.status, body.rejectReason);
  }
}
