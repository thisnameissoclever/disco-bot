import type { ModelRef, RetrievalProvider, ClarificationPolicy } from '../config/types.js';

export type RetrievalMode = 'none' | 'instructions_only' | 'hosted_file_search' | 'rag';

export type InvocationMode =
  | 'slash'
  | 'context_menu'
  | 'mention'
  | 'thread_continuation';

export interface AssistantDefaults {
  provider: 'openai' | 'anthropic' | 'openrouter';
  retrievalProvider?: RetrievalProvider;
  retrievalMode: RetrievalMode;
  primaryModel: ModelRef;
  utilityModel: ModelRef;
  escalationModel: ModelRef;
  embeddingModel: ModelRef | null;
  rerankModel: ModelRef | null;
  vectorStoreIdEnv?: string;
  vectorStoreId?: string;
}

export interface AssistantDefinition {
  id: string;
  displayName: string;
  description: string;
  allowedServerFamilies: string[];
  instructionsFile: string;
  instructions: string;
  knowledgeFiles: string[];
  knowledgeFileAbsolutePaths: string[];
  defaults: AssistantDefaults;
  maxResponseLength: number;
  defaultCommand: string;
  allowedInvocationModes: InvocationMode[];
  safetyRules: string[];
  clarificationPolicy: ClarificationPolicy;
  rootPath: string;
}
