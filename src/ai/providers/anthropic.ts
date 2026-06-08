import { ProviderNotConfiguredError } from '../../util/errors.js';
import type { ModelRequest, ModelResponse, ProviderAdapter } from '../types.js';

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async reply(_req: ModelRequest): Promise<ModelResponse> {
    throw new ProviderNotConfiguredError('anthropic');
  },
};
