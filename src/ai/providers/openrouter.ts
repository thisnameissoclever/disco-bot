import { ProviderNotConfiguredError } from '../../util/errors.js';
import type { ModelRequest, ModelResponse, ProviderAdapter } from '../types.js';

export const openrouterAdapter: ProviderAdapter = {
  id: 'openrouter',

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },

  async reply(_req: ModelRequest): Promise<ModelResponse> {
    throw new ProviderNotConfiguredError('openrouter');
  },
};
