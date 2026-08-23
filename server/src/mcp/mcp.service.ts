import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { ProblemService } from '../problem/problem.service';
import { ProblemListService } from '../problem-list/problem-list.service';
import { TagService } from '../tag/tag.service';
import { SubmissionService } from '../submission/submission.service';
import { registerProblemTools } from './tools/problem.tools';
import { registerProblemListTools } from './tools/problem-list.tools';
import { registerTagTools } from './tools/tag.tools';
import { registerPersonalTools } from './tools/personal.tools';
import { TestcaseStoreService } from '../testcase/testcase-store.service';
import { McpAdminAuditService } from './admin-audit.service';
import { registerAdminTestcaseTools } from './tools/admin-testcase.tools';
import {
  McpRateLimitConfig,
  McpRateLimitConfigService,
} from './mcp-rate-limit-config.service';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly adminWriteRateLimits = new Map<string, RateLimitEntry>();
  constructor(
    private readonly problemService: ProblemService,
    private readonly problemListService: ProblemListService,
    private readonly submissionService: SubmissionService,
    private readonly tagService: TagService,
    private readonly testcaseStore: TestcaseStoreService,
    private readonly adminAudit: McpAdminAuditService,
    private readonly rateLimitConfig: McpRateLimitConfigService,
  ) {}

  createServer(
    includePersonalTools = false,
    includeAdminTools = false,
  ): McpServer {
    const server = new McpServer({
      name: 'etloj',
      version: '0.3.0',
    });

    registerProblemTools(server, this.problemService, this.logger);
    registerProblemListTools(server, this.problemListService, this.logger);
    registerTagTools(server, this.tagService, this.logger);
    if (includePersonalTools)
      registerPersonalTools(server, this.submissionService, this.logger);
    if (includeAdminTools) {
      registerAdminTestcaseTools(
        server,
        this.problemService,
        this.testcaseStore,
        this.adminAudit,
        this,
        this.logger,
      );
    }
    return server;
  }

  consumeRateLimit(clientKey: string): {
    allowed: boolean;
    retryAfterSeconds: number;
  } {
    const config = this.rateLimitConfig.get();
    return this.consumeLimit(
      this.rateLimits,
      clientKey,
      config.globalRateLimitMax,
      config.globalRateLimitWindowMs,
    );
  }

  consumeAdminWriteRateLimit(actorUserId: number): {
    allowed: boolean;
    retryAfterSeconds: number;
  } {
    const config = this.rateLimitConfig.get();
    return this.consumeLimit(
      this.adminWriteRateLimits,
      String(actorUserId),
      config.adminWriteRateLimitMax,
      config.adminWriteRateLimitWindowMs,
    );
  }

  getRateLimits(): McpRateLimitConfig {
    return this.rateLimitConfig.get();
  }

  async updateRateLimits(
    next: McpRateLimitConfig,
  ): Promise<McpRateLimitConfig> {
    const updated = await this.rateLimitConfig.update(next);
    this.rateLimits.clear();
    this.adminWriteRateLimits.clear();
    return updated;
  }

  private consumeLimit(
    limits: Map<string, RateLimitEntry>,
    clientKey: string,
    max: number,
    windowMs: number,
  ): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const current = limits.get(clientKey);

    if (!current || current.resetAt <= now) {
      limits.set(clientKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      this.pruneExpiredEntries(limits, now);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (current.count >= max) {
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

  private pruneExpiredEntries(
    limits: Map<string, RateLimitEntry>,
    now: number,
  ): void {
    if (limits.size < 1_000) return;
    for (const [key, value] of limits) {
      if (value.resetAt <= now) limits.delete(key);
    }
  }
}
