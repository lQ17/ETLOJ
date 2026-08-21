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

@Module({
  imports: [
    ProblemModule,
    ProblemListModule,
    SubmissionModule,
    TagModule,
    TestcaseModule,
    McpAdminAuditModule,
  ],
  controllers: [McpOAuthController],
  providers: [McpService, McpOAuthService],
  exports: [McpService, McpOAuthService],
})
export class McpModule {}
