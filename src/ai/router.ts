import type { Db } from '../db/client.js';
import type { AssistantDefinition, RetrievalMode } from '../assistants/types.js';
import type { ModelRef } from '../config/types.js';
import { getValue } from '../config/service.js';
import type { ModelRole, ResolvedRole } from './types.js';

const ROLE_KEY: Record<ModelRole, string> = {
  primary: 'primary_model',
  utility: 'utility_model',
  escalation: 'escalation_model',
};

const ROLE_DEFAULT_FROM_ASSISTANT: Record<ModelRole, (a: AssistantDefinition) => ModelRef> = {
  primary: (a) => a.defaults.primaryModel,
  utility: (a) => a.defaults.utilityModel,
  escalation: (a) => a.defaults.escalationModel,
};

export interface ResolveInput {
  db: Db;
  assistant: AssistantDefinition;
  guildId: string;
  role: ModelRole;
}

export async function resolveRole(input: ResolveInput): Promise<ResolvedRole> {
  const { db, assistant, guildId, role } = input;

  // 1. Effective per-assistant model. Reads from assistant_overrides if set,
  //    else from the assistant default.
  const overrideEnabled = await getValue<boolean>(
    db,
    guildId,
    'assistant_model_override_enabled',
    assistant.id,
  );
  const assistantDefault = ROLE_DEFAULT_FROM_ASSISTANT[role](assistant);
  const overrideModel = overrideEnabled
    ? await getValue<ModelRef>(db, guildId, ROLE_KEY[role], assistant.id)
    : assistantDefault;
  const modelRef = overrideEnabled ? overrideModel : assistantDefault;

  // 2. Retrieval mode (currently the assistant's own default - guild policy
  //    only swaps PROVIDER at retrieval, not mode).
  const retrievalMode: RetrievalMode = assistant.defaults.retrievalMode;

  // 3. Vector store ids when applicable.
  const vectorStoreIds: string[] = [];
  if (retrievalMode === 'hosted_file_search') {
    const guildOverride = await getValue<string | null>(
      db,
      guildId,
      'vector_store_id',
      assistant.id,
    );
    if (guildOverride) vectorStoreIds.push(guildOverride);
    else if (assistant.defaults.vectorStoreId) vectorStoreIds.push(assistant.defaults.vectorStoreId);
  }

  // 4. Token + sampling.
  const maxOutputTokensMap = await getValue<Record<string, number>>(
    db,
    guildId,
    'max_output_tokens',
    assistant.id,
  );
  const temperatureMap = await getValue<Record<string, number | null>>(
    db,
    guildId,
    'temperatures',
    assistant.id,
  );
  const reasoningMap = await getValue<Record<string, { effort?: 'low' | 'medium' | 'high'; maxThinkingTokens?: number }>>(
    db,
    guildId,
    'reasoning_settings',
    assistant.id,
  );
  const fallbackMap = await getValue<Record<string, ModelRef>>(
    db,
    guildId,
    'fallback_models',
    assistant.id,
  );

  const maxOutputTokens = maxOutputTokensMap[role] ?? defaultTokens(role);
  const temperature = role in temperatureMap ? temperatureMap[role]! : defaultTemperature(role);
  const reasoning = reasoningMap[role];
  const fallback = fallbackMap[role];

  return {
    modelRef,
    retrievalMode,
    vectorStoreIds,
    maxOutputTokens,
    temperature,
    ...(reasoning ? { reasoning } : {}),
    ...(fallback ? { fallback } : {}),
  };
}

function defaultTokens(role: ModelRole): number {
  switch (role) {
    case 'primary':
      return 1500;
    case 'utility':
      return 600;
    case 'escalation':
      return 4000;
  }
}

function defaultTemperature(role: ModelRole): number {
  switch (role) {
    case 'primary':
      return 0.4;
    case 'utility':
      return 0.2;
    case 'escalation':
      return 0.3;
  }
}
