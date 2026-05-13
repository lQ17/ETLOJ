import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";

@Injectable()
export class AnnouncementService {
  constructor(private prisma: PrismaService) {}

  async findPublished(page = 1, pageSize = 5) {
    const where = { status: "PUBLISHED" };
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items, total };
  }

  async findOnePublic(id: number) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, status: "PUBLISHED" },
    });
    if (!announcement) throw new NotFoundException("公告不存在");
    return announcement;
  }

  async findOneForAdmin(id: number) {
    return this.findOneOrThrow(id);
  }

  async findAllForAdmin(status?: string, page = 1, pageSize = 20) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items, total };
  }

  async create(authorId: number, dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        summary: dto.summary,
        content: dto.content || "",
        isPinned: dto.isPinned ?? false,
        status: dto.status ?? "DRAFT",
        authorId,
      },
    });
  }

  async update(id: number, dto: UpdateAnnouncementDto) {
    await this.findOneOrThrow(id);
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(id: number) {
    await this.findOneOrThrow(id);
    return this.prisma.announcement.delete({ where: { id } });
  }

  private async findOneOrThrow(id: number) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!announcement) throw new NotFoundException("公告不存在");
    return announcement;
  }
}
