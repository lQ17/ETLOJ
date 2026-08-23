import { McpAdminAuditService } from './admin-audit.service';
import {
  McpRateLimitConfig,
  McpRateLimitConfigService,
} from './mcp-rate-limit-config.service';
import { McpService } from './mcp.service';
import { ProblemListService } from '../problem-list/problem-list.service';
import { ProblemService } from '../problem/problem.service';
import { SubmissionService } from '../submission/submission.service';
import { TagService } from '../tag/tag.service';
import { TestcaseStoreService } from '../testcase/testcase-store.service';

describe('McpService runtime rate limits', () => {
  it('applies updated limits immediately and clears previous windows', async () => {
    let current: McpRateLimitConfig = {
      globalRateLimitMax: 1,
      globalRateLimitWindowMs: 60_000,
      adminWriteRateLimitMax: 1,
      adminWriteRateLimitWindowMs: 60_000,
    };
    const configStore = {
      get: jest.fn(() => ({ ...current })),
      update: jest.fn((next: McpRateLimitConfig) => {
        current = { ...next };
        return Promise.resolve({ ...current });
      }),
    } as unknown as McpRateLimitConfigService;
    const service = new McpService(
      {} as ProblemService,
      {} as ProblemListService,
      {} as SubmissionService,
      {} as TagService,
      {} as TestcaseStoreService,
      {} as McpAdminAuditService,
      configStore,
    );

    expect(service.consumeRateLimit('127.0.0.1').allowed).toBe(true);
    expect(service.consumeRateLimit('127.0.0.1').allowed).toBe(false);
    expect(service.consumeAdminWriteRateLimit(7).allowed).toBe(true);
    expect(service.consumeAdminWriteRateLimit(7).allowed).toBe(false);

    const updated = {
      ...current,
      globalRateLimitMax: 2,
      adminWriteRateLimitMax: 2,
    };
    await expect(service.updateRateLimits(updated)).resolves.toEqual(updated);

    expect(service.consumeRateLimit('127.0.0.1').allowed).toBe(true);
    expect(service.consumeRateLimit('127.0.0.1').allowed).toBe(true);
    expect(service.consumeRateLimit('127.0.0.1').allowed).toBe(false);
    expect(service.consumeAdminWriteRateLimit(7).allowed).toBe(true);
    expect(service.consumeAdminWriteRateLimit(7).allowed).toBe(true);
    expect(service.consumeAdminWriteRateLimit(7).allowed).toBe(false);
  });
});
