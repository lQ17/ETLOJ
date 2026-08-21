import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { McpAdminAuditService } from './admin-audit.service';

/**
 * Kept separate so the MCP module can opt into audit persistence without
 * coupling this independent layer to tool registration changes.
 */
@Module({
  imports: [PrismaModule],
  providers: [McpAdminAuditService],
  exports: [McpAdminAuditService],
})
export class McpAdminAuditModule {}
