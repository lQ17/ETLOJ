import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateMcpRateLimitsDto } from './dto/update-mcp-rate-limits.dto';
import { McpService } from './mcp.service';

@Controller('mcp/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class McpAdminController {
  constructor(private readonly mcpService: McpService) {}

  @Get('rate-limits')
  getRateLimits() {
    return this.mcpService.getRateLimits();
  }

  @Patch('rate-limits')
  updateRateLimits(@Body() dto: UpdateMcpRateLimitsDto) {
    return this.mcpService.updateRateLimits(dto);
  }
}
