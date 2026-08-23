import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface McpRateLimitConfig {
  globalRateLimitMax: number;
  globalRateLimitWindowMs: number;
  adminWriteRateLimitMax: number;
  adminWriteRateLimitWindowMs: number;
}

export const MCP_RATE_LIMIT_BOUNDS = {
  globalRateLimitMax: { min: 1, max: 100_000 },
  globalRateLimitWindowMs: { min: 1_000, max: 86_400_000 },
  adminWriteRateLimitMax: { min: 1, max: 10_000 },
  adminWriteRateLimitWindowMs: { min: 1_000, max: 86_400_000 },
} as const;

const REDIS_KEY = 'mcp:config:rate-limits';

@Injectable()
export class McpRateLimitConfigService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(McpRateLimitConfigService.name);
  private readonly redis: ReturnType<typeof createClient>;
  private current: McpRateLimitConfig;

  constructor(config: ConfigService) {
    this.current = {
      globalRateLimitMax: this.readBoundedInteger(
        config.get<string>('MCP_RATE_LIMIT_MAX'),
        60,
        MCP_RATE_LIMIT_BOUNDS.globalRateLimitMax,
      ),
      globalRateLimitWindowMs: this.readBoundedInteger(
        config.get<string>('MCP_RATE_LIMIT_WINDOW_MS'),
        60_000,
        MCP_RATE_LIMIT_BOUNDS.globalRateLimitWindowMs,
      ),
      adminWriteRateLimitMax: this.readBoundedInteger(
        config.get<string>('MCP_ADMIN_WRITE_RATE_LIMIT_MAX'),
        10,
        MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitMax,
      ),
      adminWriteRateLimitWindowMs: this.readBoundedInteger(
        config.get<string>('MCP_ADMIN_WRITE_RATE_LIMIT_WINDOW_MS'),
        60_000,
        MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitWindowMs,
      ),
    };
    this.redis = createClient({ url: config.get<string>('REDIS_URL') });
    this.redis.on('error', (error: unknown) => {
      this.logger.warn(
        `MCP rate-limit Redis error: ${this.errorMessage(error)}`,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureConnected();
      const stored = await this.redis.get(REDIS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (this.isValidConfig(parsed)) this.current = { ...parsed };
      else
        this.logger.warn('Ignoring invalid persisted MCP rate-limit config.');
    } catch (error) {
      this.logger.warn(
        `Using environment MCP rate-limit defaults: ${this.errorMessage(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.isOpen) await this.redis.quit();
  }

  get(): McpRateLimitConfig {
    return { ...this.current };
  }

  async update(next: McpRateLimitConfig): Promise<McpRateLimitConfig> {
    if (!this.isValidConfig(next)) {
      throw new TypeError('Invalid MCP rate-limit configuration.');
    }
    try {
      await this.ensureConnected();
      await this.redis.set(REDIS_KEY, JSON.stringify(next));
    } catch (error) {
      throw new ServiceUnavailableException(
        `Unable to persist MCP rate-limit configuration: ${this.errorMessage(error)}`,
      );
    }
    this.current = { ...next };
    return this.get();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.redis.isOpen) await this.redis.connect();
  }

  private isValidConfig(value: unknown): value is McpRateLimitConfig {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return Object.entries(MCP_RATE_LIMIT_BOUNDS).every(([key, bounds]) => {
      const entry = candidate[key];
      return (
        Number.isSafeInteger(entry) &&
        (entry as number) >= bounds.min &&
        (entry as number) <= bounds.max
      );
    });
  }

  private readBoundedInteger(
    value: string | undefined,
    fallback: number,
    bounds: { min: number; max: number },
  ): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) &&
      parsed >= bounds.min &&
      parsed <= bounds.max
      ? parsed
      : fallback;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
