import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
} from "@nestjs/common";
import { AnnouncementStatus } from "@prisma/client";
import { AnnouncementService } from "./announcement.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("announcements")
export class AnnouncementController {
  constructor(private announcementService: AnnouncementService) {}

  @Get()
  findPublished(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.announcementService.findPublished(
      page ? +page : 1,
      pageSize ? +pageSize : 5,
    );
  }

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  findAllForAdmin(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.announcementService.findAllForAdmin(
      (status as AnnouncementStatus) || undefined,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }

  @Get("admin/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  findOneForAdmin(@Param("id", ParseIntPipe) id: number) {
    return this.announcementService.findOneForAdmin(id);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.announcementService.findOnePublic(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  create(
    @CurrentUser("id") userId: number,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementService.create(userId, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.announcementService.remove(id);
  }
}
