import { Module } from '@nestjs/common';
import { ProblemModule } from '../problem/problem.module';
import { ProblemListModule } from '../problem-list/problem-list.module';
import { TagModule } from '../tag/tag.module';
import { SubmissionModule } from '../submission/submission.module';
import { McpService } from './mcp.service';
import { McpOAuthController } from './auth/mcp-oauth.controller';
import { McpOAuthService } from './auth/mcp-oauth.service';
import { TestcaseModule } from '../testcase/testcase.module';
import { McpAdminAuditModule } from './admin-audit.module';
import { McpAdminController } from './mcp-admin.controller';
import { McpRateLimitConfigService } from './mcp-rate-limit-config.service';

@Module({
  imports: [
    ProblemModule,
    ProblemListModule,
    SubmissionModule,
    TagModule,
    TestcaseModule,
    McpAdminAuditModule,
  ],
  controllers: [McpOAuthController, McpAdminController],
  providers: [McpService, McpOAuthService, McpRateLimitConfigService],
  exports: [McpService, McpOAuthService],
})
export class McpModule {}
