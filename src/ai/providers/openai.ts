import OpenAI from 'openai';
import { loadEnv } from '../../env.js';
import { childLogger } from '../../util/logger.js';
import { ProviderNotConfiguredError, RetrievalUnavailableError } from '../../util/errors.js';
import { clarificationSnippet } from '../clarification.js';
import type { ContextMessage, ModelRequest, ModelResponse, ProviderAdapter } from '../types.js';

const log = childLogger({ component: 'ai.openai' });

let cachedClient: OpenAI | undefined;

function client(): OpenAI {
  if (cachedClient) return cachedClient;
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) {
    throw new ProviderNotConfiguredError('openai');
  }
  cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cachedClient;
}

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',

  isConfigured(): boolean {
    return Boolean(loadEnv().OPENAI_API_KEY);
  },

  async reply(req: ModelRequest): Promise<ModelResponse> {
    const c = client();
    const params = buildParams(req);
    log.debug(
      {
        model: params.model,
        tools: params.tools?.map((t) => t.type),
        hasPrev: Boolean(params.previous_response_id),
      },
      'openai.responses.create',
    );

    const response = await c.responses.create(params);

    const text = extractText(response);
    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens ?? undefined,
          outputTokens: response.usage.output_tokens ?? undefined,
          totalTokens: response.usage.total_tokens ?? undefined,
        }
      : undefined;

    return {
      text,
      providerResponseId: response.id,
      ...(usage ? { usage } : {}),
    };
  },
};

interface ResponsesCreateParams {
  model: string;
  input: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_output_tokens: number;
  tools?: Array<{ type: 'file_search'; vector_store_ids: string[] }>;
  previous_response_id?: string;
  temperature?: number;
  reasoning?: { effort?: 'low' | 'medium' | 'high' };
}

function buildParams(req: ModelRequest): ResponsesCreateParams {
  const policySnippet = clarificationSnippet(req.clarificationPolicy);
  const systemInstructions =
    req.systemInstructions.trim().length > 0
      ? `${req.systemInstructions}\n\n${policySnippet}`
      : policySnippet;

  const input: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  input.push({ role: 'system', content: systemInstructions });
  for (const msg of req.contextMessages) {
    input.push({ role: roleFor(msg), content: formatMessage(msg) });
  }
  input.push({ role: 'user', content: req.userPrompt });

  const params: ResponsesCreateParams = {
    model: req.modelRef.modelId,
    input,
    max_output_tokens: req.maxOutputTokens,
  };

  if (req.knowledge.mode === 'hosted_file_search') {
    if (req.knowledge.vectorStoreIds.length === 0) {
      throw new RetrievalUnavailableError(
        'hosted_file_search',
        'no OpenAI vector store id is configured for this assistant',
      );
    }
    params.tools = [
      { type: 'file_search', vector_store_ids: req.knowledge.vectorStoreIds },
    ];
  } else if (req.knowledge.mode === 'rag') {
    throw new RetrievalUnavailableError(
      'rag',
      'self-managed RAG is not implemented in this build',
    );
  }

  if (req.previousResponseId) params.previous_response_id = req.previousResponseId;
  if (typeof req.temperature === 'number') params.temperature = req.temperature;
  if (req.reasoning?.effort) params.reasoning = { effort: req.reasoning.effort };

  return params;
}

function roleFor(msg: ContextMessage): 'system' | 'user' | 'assistant' {
  if (msg.role === 'system') return 'system';
  if (msg.role === 'assistant') return 'assistant';
  return 'user';
}

function formatMessage(msg: ContextMessage): string {
  const author = msg.authorDisplayName ? `${msg.authorDisplayName}: ` : '';
  const source = msg.source ? ` [${msg.source}]` : '';
  return `${author}${msg.content}${source}`;
}

interface ResponsesOutput {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string | { value?: string } }>;
  }>;
}

function extractText(response: unknown): string {
  const r = response as ResponsesOutput;
  if (typeof r.output_text === 'string' && r.output_text.length > 0) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) {
    for (const piece of item.content ?? []) {
      if (typeof piece.text === 'string') parts.push(piece.text);
      else if (piece.text && typeof piece.text.value === 'string') parts.push(piece.text.value);
    }
  }
  return parts.join('').trim();
}
