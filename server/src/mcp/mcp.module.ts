import { Module } from '@nestjs/common';
import { ProblemModule } from '../problem/problem.module';
import { TagModule } from '../tag/tag.module';
import { McpService } from './mcp.service';

@Module({
  imports: [ProblemModule, TagModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
