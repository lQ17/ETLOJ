import { Injectable } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiConversationService } from './ai-conversation.service';
import { AiQuotaService } from './ai-quota.service';
import { AiStatsService } from './ai-stats.service';

@Injectable()
export class AiService {
  constructor(
    private providerService: AiProviderService,
    private conversationService: AiConversationService,
    private quotaService: AiQuotaService,
    private statsService: AiStatsService,
  ) {}

  // ─── Provider CRUD ───

  getProviders() {
    return this.providerService.getProviders();
  }

  addProvider(dto: { name: string; apiBase: string; apiKey: string; modelName: string; isActive?: boolean }) {
    return this.providerService.addProvider(dto);
  }

  updateProvider(id: number, dto: { name?: string; apiBase?: string; apiKey?: string; modelName?: string; isActive?: boolean }) {
    return this.providerService.updateProvider(id, dto);
  }

  deleteProvider(id: number) {
    return this.providerService.deleteProvider(id);
  }

  activateProvider(id: number) {
    return this.providerService.activateProvider(id);
  }

  fetchAvailableModels(apiBase: string, apiKey: string) {
    return this.providerService.fetchAvailableModels(apiBase, apiKey);
  }

  getActiveProvider() {
    return this.providerService.getActiveProvider();
  }

  getGlobalLimit() {
    return this.providerService.getGlobalLimit();
  }

  setGlobalLimit(dailyLimit: number) {
    return this.providerService.setGlobalLimit(dailyLimit);
  }

  // ─── Conversation / Chat ───

  getRemainingUses(userId: number, role: string) {
    return this.quotaService.getRemainingUses(userId, role);
  }

  getHistory(userId: number, problemId: number) {
    return this.conversationService.getHistory(userId, problemId);
  }

  clearHistory(userId: number, problemId: number) {
    return this.conversationService.clearHistory(userId, problemId);
  }

  chat(
    user: { id: number; role: string },
    dto: { messages: any[]; problemId: number; currentCode?: string; language?: string; promptConfigId?: number; regenerate?: boolean },
    res: any,
    req?: any,
  ) {
    return this.conversationService.chat(user, dto, res, req);
  }

  // ─── Stats / Quotas ───

  getStats() {
    return this.statsService.getStats();
  }

  getUsageLogs(page: number, pageSize: number, filters?: { provider?: string, model?: string, startDate?: string, endDate?: string }) {
    return this.statsService.getUsageLogs(page, pageSize, filters);
  }

  getUsersQuotas(page?: number, pageSize?: number, username?: string) {
    return this.statsService.getUsersQuotas(page, pageSize, username);
  }

  updateUserQuota(userId: number, aiDailyLimit: number | null) {
    return this.statsService.updateUserQuota(userId, aiDailyLimit);
  }

  // ─── Prompt Config ───

  getPromptConfigs() {
    return this.providerService.getPromptConfigs();
  }

  getPublicPromptConfigs() {
    return this.providerService.getPublicPromptConfigs();
  }

  addPromptConfig(dto: { name: string; role: string; codeRules: string; replyRules: string; isActive?: boolean }) {
    return this.providerService.addPromptConfig(dto);
  }

  updatePromptConfig(id: number, dto: { name?: string; role?: string; codeRules?: string; replyRules?: string; isActive?: boolean }) {
    return this.providerService.updatePromptConfig(id, dto);
  }

  deletePromptConfig(id: number) {
    return this.providerService.deletePromptConfig(id);
  }

  activatePromptConfig(id: number) {
    return this.providerService.activatePromptConfig(id);
  }
}
