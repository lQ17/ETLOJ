import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderService } from './ai-provider.service';
import { AiConversationService } from './ai-conversation.service';
import { AiQuotaService } from './ai-quota.service';
import { AiPromptService } from './ai-prompt.service';
import { AiStatsService } from './ai-stats.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, AiProviderService, AiConversationService, AiQuotaService, AiPromptService, AiStatsService],
})
export class AiModule {}
