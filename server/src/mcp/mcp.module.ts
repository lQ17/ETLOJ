import { Module } from '@nestjs/common';
import { ProblemModule } from '../problem/problem.module';
import { McpService } from './mcp.service';

@Module({
  imports: [ProblemModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
