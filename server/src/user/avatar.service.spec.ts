import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarService } from './avatar.service';

type FindManyArgs = {
  where: { avatar: { startsWith: string } };
  select: { id: boolean; avatar: boolean };
};
type UpdateArgs = {
  where: { id: number };
  data: { avatar: string };
};

describe('AvatarService', () => {
  let avatarsDir: string;
  let prisma: {
    user: {
      findMany: jest.Mock<unknown, [FindManyArgs]>;
      update: jest.Mock<unknown, [UpdateArgs]>;
    };
  };
  let service: AvatarService;

  beforeEach(async () => {
    avatarsDir = await mkdtemp(join(tmpdir(), 'etloj-avatar-'));
    prisma = {
      user: {
        findMany: jest.fn<unknown, [FindManyArgs]>().mockResolvedValue([]),
        update: jest.fn<unknown, [UpdateArgs]>(),
      },
    };
    service = new AvatarService(
      prisma as unknown as PrismaService,
      {
        get: (key: string) => (key === 'AVATARS_DIR' ? avatarsDir : undefined),
      } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    await rm(avatarsDir, { recursive: true, force: true });
  });

  async function createPngDataUrl() {
    const png = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 30, g: 120, b: 210 },
      },
    })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  }

  it('stores a square 256px WebP behind a versioned URL', async () => {
    const avatarUrl = await service.saveDataUrl(7, await createPngDataUrl());
    expect(avatarUrl).toMatch(/^\/api\/avatars\/7\/[a-f0-9]{16}\.webp$/);

    const version = avatarUrl.split('/').pop()!.replace('.webp', '');
    const output = await readFile(service.getFilePath(7, version));
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect(output.length).toBeLessThanOrEqual(50 * 1024);
  });

  it('migrates legacy Base64 avatars on application startup', async () => {
    const legacyAvatar = await createPngDataUrl();
    prisma.user.findMany.mockResolvedValue([{ id: 9, avatar: legacyAvatar }]);
    prisma.user.update.mockResolvedValue({});

    await service.onApplicationBootstrap();

    const update = prisma.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 9 });
    expect(update.data.avatar).toMatch(
      /^\/api\/avatars\/9\/[a-f0-9]{16}\.webp$/,
    );
  });
});
