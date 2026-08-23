import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { McpAdminController } from './mcp-admin.controller';
import { McpRateLimitConfig } from './mcp-rate-limit-config.service';
import { McpService } from './mcp.service';

describe('McpAdminController', () => {
  const config: McpRateLimitConfig = {
    globalRateLimitMax: 60,
    globalRateLimitWindowMs: 60_000,
    adminWriteRateLimitMax: 10,
    adminWriteRateLimitWindowMs: 60_000,
  };

  it('is restricted to authenticated administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, McpAdminController)).toEqual([
      'ADMIN',
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, McpAdminController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('reads and updates the live service configuration', async () => {
    const updateRateLimits = jest.fn().mockResolvedValue(config);
    const mcpService = {
      getRateLimits: jest.fn(() => config),
      updateRateLimits,
    } as unknown as McpService;
    const controller = new McpAdminController(mcpService);

    expect(controller.getRateLimits()).toEqual(config);
    await expect(controller.updateRateLimits(config)).resolves.toEqual(config);
    expect(updateRateLimits).toHaveBeenCalledWith(config);
  });
});
