import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createClient } from 'redis';
import { McpRateLimitConfigService } from './mcp-rate-limit-config.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('McpRateLimitConfigService', () => {
  const persisted = {
    globalRateLimitMax: 120,
    globalRateLimitWindowMs: 30_000,
    adminWriteRateLimitMax: 20,
    adminWriteRateLimitWindowMs: 120_000,
  };
  let redis: {
    isOpen: boolean;
    on: jest.Mock;
    connect: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    redis = {
      isOpen: false,
      on: jest.fn(),
      connect: jest.fn().mockImplementation(() => {
        redis.isOpen = true;
        return Promise.resolve();
      }),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockImplementation(() => {
        redis.isOpen = false;
        return Promise.resolve();
      }),
    };
    jest.mocked(createClient).mockReturnValue(redis as never);
  });

  function createService(values: Record<string, string> = {}) {
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new McpRateLimitConfigService(config);
  }

  it('uses bounded environment defaults and restores a valid Redis value', async () => {
    redis.get.mockResolvedValue(JSON.stringify(persisted));
    const service = createService({
      REDIS_URL: 'redis://test',
      MCP_RATE_LIMIT_MAX: '90',
      MCP_RATE_LIMIT_WINDOW_MS: 'invalid',
      MCP_ADMIN_WRITE_RATE_LIMIT_MAX: '0',
      MCP_ADMIN_WRITE_RATE_LIMIT_WINDOW_MS: '2000',
    });

    expect(service.get()).toEqual({
      globalRateLimitMax: 90,
      globalRateLimitWindowMs: 60_000,
      adminWriteRateLimitMax: 10,
      adminWriteRateLimitWindowMs: 2_000,
    });
    await service.onModuleInit();
    expect(redis.connect).toHaveBeenCalledTimes(1);
    expect(service.get()).toEqual(persisted);
  });

  it('persists the complete config before publishing it in memory', async () => {
    const service = createService();
    await expect(service.update(persisted)).resolves.toEqual(persisted);
    expect(redis.set).toHaveBeenCalledWith(
      'mcp:config:rate-limits',
      JSON.stringify(persisted),
    );
    expect(service.get()).toEqual(persisted);
  });

  it('keeps the active config unchanged when persistence fails', async () => {
    redis.set.mockRejectedValue(new Error('offline'));
    const service = createService();
    const before = service.get();

    await expect(service.update(persisted)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(service.get()).toEqual(before);
  });

  it('ignores invalid persisted values', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ ...persisted, globalRateLimitMax: 0 }),
    );
    const service = createService();
    const before = service.get();
    await service.onModuleInit();
    expect(service.get()).toEqual(before);
  });
});
