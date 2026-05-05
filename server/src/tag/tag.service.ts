import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { problems: true } },
      },
    });
  }

  async findOne(id: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { problems: true } } },
    });
    if (!tag) throw new NotFoundException("标签不存在");
    return tag;
  }

  async create(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException("标签名已存在");
    return this.prisma.tag.create({ data: dto });
  }

  async update(id: number, dto: UpdateTagDto) {
    const tag = await this.findOne(id);
    if (dto.name && dto.name !== tag.name) {
      const existing = await this.prisma.tag.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException("标签名已存在");
    }
    return this.prisma.tag.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.tag.delete({ where: { id } });
  }
}
