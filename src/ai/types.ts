import type { ModelRef, ClarificationPolicy } from '../config/types.js';
import type { RetrievalMode } from '../assistants/types.js';

export type ModelRole = 'primary' | 'utility' | 'escalation';

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  authorDisplayName?: string;
  content: string;
  source?: string;
}

export type KnowledgeRef =
  | { mode: 'none' }
  | { mode: 'instructions_only' }
  | { mode: 'hosted_file_search'; vectorStoreIds: string[] }
  | { mode: 'rag'; chunks: Array<{ source: string; text: string }> };

export interface ReasoningConfig {
  effort?: 'low' | 'medium' | 'high';
  maxThinkingTokens?: number;
}

export interface ModelRequest {
  modelRef: ModelRef;
  systemInstructions: string;
  userPrompt: string;
  contextMessages: ContextMessage[];
  knowledge: KnowledgeRef;
  maxOutputTokens: number;
  temperature?: number | null;
  reasoning?: ReasoningConfig;
  previousResponseId?: string;
  clarificationPolicy: ClarificationPolicy;
}

export interface ModelResponse {
  text: string;
  providerResponseId?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  rawFinishReason?: string;
}

export interface ProviderAdapter {
  readonly id: 'openai' | 'anthropic' | 'openrouter';
  isConfigured(): boolean;
  reply(input: ModelRequest): Promise<ModelResponse>;
}

export interface ResolvedRole {
  modelRef: ModelRef;
  retrievalMode: RetrievalMode;
  vectorStoreIds: string[];
  maxOutputTokens: number;
  temperature: number | null;
  reasoning?: ReasoningConfig;
  fallback?: ModelRef;
}
