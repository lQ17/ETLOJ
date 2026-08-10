import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { ProblemService } from '../problem/problem.service';
import { TagService } from '../tag/tag.service';
import { registerProblemTools } from './tools/problem.tools';
import { registerTagTools } from './tools/tag.tools';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly rateLimitMax = this.readPositiveInteger(
    'MCP_RATE_LIMIT_MAX',
    60,
  );
  private readonly rateLimitWindowMs = this.readPositiveInteger(
    'MCP_RATE_LIMIT_WINDOW_MS',
    60_000,
  );

  constructor(
    private readonly problemService: ProblemService,
    private readonly tagService: TagService,
  ) {}

  createServer(): McpServer {
    const server = new McpServer({
      name: 'etloj',
      version: '0.2.0',
    });

    registerProblemTools(server, this.problemService, this.logger);
    registerTagTools(server, this.tagService, this.logger);
    return server;
  }

  consumeRateLimit(clientKey: string): {
    allowed: boolean;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const current = this.rateLimits.get(clientKey);

    if (!current || current.resetAt <= now) {
      this.rateLimits.set(clientKey, {
        count: 1,
        resetAt: now + this.rateLimitWindowMs,
      });
      this.pruneExpiredEntries(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= this.rateLimitMax) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - now) / 1000),
        ),
      };
    }

    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private pruneExpiredEntries(now: number): void {
    if (this.rateLimits.size < 1_000) return;
    for (const [key, value] of this.rateLimits) {
      if (value.resetAt <= now) this.rateLimits.delete(key);
    }
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
