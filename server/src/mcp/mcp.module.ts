import { Module } from '@nestjs/common';
import { ProblemModule } from '../problem/problem.module';
import { ProblemListModule } from '../problem-list/problem-list.module';
import { TagModule } from '../tag/tag.module';
import { SubmissionModule } from '../submission/submission.module';
import { McpService } from './mcp.service';
import { McpOAuthController } from './auth/mcp-oauth.controller';
import { McpOAuthService } from './auth/mcp-oauth.service';

@Module({
  imports: [ProblemModule, ProblemListModule, SubmissionModule, TagModule],
  controllers: [McpOAuthController],
  providers: [McpService, McpOAuthService],
  exports: [McpService, McpOAuthService],
})
export class McpModule {}
