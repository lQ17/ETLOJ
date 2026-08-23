import { IsInt, Max, Min } from 'class-validator';
import { MCP_RATE_LIMIT_BOUNDS } from '../mcp-rate-limit-config.service';

export class UpdateMcpRateLimitsDto {
  @IsInt()
  @Min(MCP_RATE_LIMIT_BOUNDS.globalRateLimitMax.min)
  @Max(MCP_RATE_LIMIT_BOUNDS.globalRateLimitMax.max)
  globalRateLimitMax: number;

  @IsInt()
  @Min(MCP_RATE_LIMIT_BOUNDS.globalRateLimitWindowMs.min)
  @Max(MCP_RATE_LIMIT_BOUNDS.globalRateLimitWindowMs.max)
  globalRateLimitWindowMs: number;

  @IsInt()
  @Min(MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitMax.min)
  @Max(MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitMax.max)
  adminWriteRateLimitMax: number;

  @IsInt()
  @Min(MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitWindowMs.min)
  @Max(MCP_RATE_LIMIT_BOUNDS.adminWriteRateLimitWindowMs.max)
  adminWriteRateLimitWindowMs: number;
}
