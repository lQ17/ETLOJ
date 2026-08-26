import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

const DATA_URL_PATTERN =
  /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;
const MANAGED_AVATAR_PATTERN = /^\/api\/avatars\/(\d+)\/([a-f0-9]{16})\.webp$/;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const TARGET_BYTES = 50 * 1024;

@Injectable()
export class AvatarService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AvatarService.name);
  private readonly avatarsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.avatarsDir = resolve(
      config.get<string>('AVATARS_DIR') ||
        join(process.cwd(), '..', 'data', 'avatars'),
    );
  }

  async onApplicationBootstrap() {
    await mkdir(this.avatarsDir, { recursive: true });
    await this.migrateLegacyAvatars();
  }

  async saveDataUrl(userId: number, dataUrl: string): Promise<string> {
    const input = this.decodeDataUrl(dataUrl);
    const output = await this.toWebp(input);
    const version = createHash('sha256')
      .update(output)
      .digest('hex')
      .slice(0, 16);
    const filename = `${userId}-${version}.webp`;
    const finalPath = join(this.avatarsDir, filename);
    const temporaryPath = join(
      this.avatarsDir,
      `.${filename}.${process.pid}.${randomUUID()}.tmp`,
    );

    await mkdir(this.avatarsDir, { recursive: true });
    await writeFile(temporaryPath, output, { flag: 'wx' });
    try {
      await rename(temporaryPath, finalPath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await unlink(temporaryPath).catch(() => undefined);
    }

    return `/api/avatars/${userId}/${version}.webp`;
  }

  getFilePath(userId: number, version: string): string {
    if (!/^[a-f0-9]{16}$/.test(version))
      throw new NotFoundException('头像不存在');
    return join(this.avatarsDir, `${userId}-${version}.webp`);
  }

  async removePrevious(
    userId: number,
    currentUrl: string,
    previousUrl?: string | null,
  ) {
    if (!previousUrl || previousUrl === currentUrl) return;
    const match = previousUrl.match(MANAGED_AVATAR_PATTERN);
    if (!match || Number(match[1]) !== userId) return;
    await unlink(join(this.avatarsDir, `${userId}-${match[2]}.webp`)).catch(
      () => undefined,
    );
  }

  private decodeDataUrl(dataUrl: string): Buffer {
    const match = dataUrl.match(DATA_URL_PATTERN);
    if (!match)
      throw new BadRequestException('头像必须是 JPG、PNG 或 WebP 图片');

    const input = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
    if (!input.length) throw new BadRequestException('头像文件为空');
    if (input.length > MAX_INPUT_BYTES)
      throw new BadRequestException('头像原图不能超过 5MB');
    return input;
  }

  private async toWebp(input: Buffer): Promise<Buffer> {
    try {
      const image = sharp(input, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize(256, 256, { fit: 'cover', position: 'attention' });

      for (const quality of [80, 72, 64]) {
        const output = await image
          .clone()
          .webp({ quality, alphaQuality: 80, effort: 4 })
          .toBuffer();
        if (output.length <= TARGET_BYTES || quality === 64) return output;
      }
      throw new Error('头像转换失败');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('无法读取头像图片，请换一张图片重试');
    }
  }

  private async migrateLegacyAvatars() {
    const users = await this.prisma.user.findMany({
      where: { avatar: { startsWith: 'data:image/' } },
      select: { id: true, avatar: true },
    });
    if (!users.length) return;

    let migrated = 0;
    const failedUserIds: number[] = [];
    for (const user of users) {
      if (!user.avatar) continue;
      try {
        const avatarUrl = await this.saveDataUrl(user.id, user.avatar);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { avatar: avatarUrl },
        });
        migrated += 1;
      } catch (error) {
        failedUserIds.push(user.id);
        this.logger.error(
          `迁移用户 ${user.id} 的旧头像失败`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    this.logger.log(`旧头像迁移完成：${migrated}/${users.length}`);
    if (failedUserIds.length) {
      throw new Error(`以下用户的旧头像迁移失败：${failedUserIds.join(', ')}`);
    }
  }
}
