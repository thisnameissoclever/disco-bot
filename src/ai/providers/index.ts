import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';
import { openrouterAdapter } from './openrouter.js';
import type { ProviderAdapter } from '../types.js';
import { ProviderNotConfiguredError } from '../../util/errors.js';

const ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  openrouter: openrouterAdapter,
};

export function getAdapter(providerId: string): ProviderAdapter {
  const adapter = ADAPTERS[providerId];
  if (!adapter) throw new ProviderNotConfiguredError(providerId);
  return adapter;
}

export function listAdapters(): ProviderAdapter[] {
  return Object.values(ADAPTERS);
}
