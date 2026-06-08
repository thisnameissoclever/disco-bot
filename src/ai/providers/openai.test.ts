import { describe, expect, it, vi, beforeEach } from 'vitest';

// We test the buildParams helper indirectly by mocking the OpenAI client and
// asserting on the params it receives.
const responseFixture = {
  id: 'resp_test_123',
  output_text: 'hello there',
  usage: { input_tokens: 12, output_tokens: 7, total_tokens: 19 },
};

const create = vi.fn(async () => responseFixture);

vi.mock('openai', () => ({
  default: class FakeOpenAI {
    public readonly responses = { create };
  },
}));

vi.mock('../../env.js', () => ({
  loadEnv: () => ({
    OPENAI_API_KEY: 'test',
    DATABASE_URL: 'postgres://x',
    DISCORD_TOKEN: 't',
    DISCORD_CLIENT_ID: 'c',
    NODE_ENV: 'test' as const,
    LOG_LEVEL: 'silent' as const,
  }),
  resetEnvCache: () => undefined,
}));

import { openaiAdapter } from './openai.js';

beforeEach(() => create.mockClear());

describe('openaiAdapter.reply', () => {
  it('produces a Responses API call with file_search when hosted_file_search is used', async () => {
    const result = await openaiAdapter.reply({
      modelRef: { provider: 'openai', modelId: 'gpt-5-mini' },
      systemInstructions: 'You are ServiceNow assistant',
      userPrompt: 'How do I optimize a business rule?',
      contextMessages: [],
      knowledge: { mode: 'hosted_file_search', vectorStoreIds: ['vs_abc'] },
      maxOutputTokens: 1500,
      temperature: 0.4,
      clarificationPolicy: 'ask_when_needed',
    });

    expect(result.providerResponseId).toBe('resp_test_123');
    expect(result.text).toBe('hello there');
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 7, totalTokens: 19 });

    expect(create).toHaveBeenCalledTimes(1);
    const callArgs = create.mock.calls[0]?.[0] as any;
    expect(callArgs.model).toBe('gpt-5-mini');
    expect(callArgs.temperature).toBe(0.4);
    expect(callArgs.max_output_tokens).toBe(1500);
    expect(callArgs.tools).toEqual([
      { type: 'file_search', vector_store_ids: ['vs_abc'] },
    ]);
    // System message contains assistant instructions AND clarification snippet.
    expect(callArgs.input[0].role).toBe('system');
    expect(callArgs.input[0].content).toContain('ServiceNow assistant');
    expect(callArgs.input[0].content).toContain('Clarification policy');
    // Last input is the user prompt.
    expect(callArgs.input.at(-1)).toEqual({
      role: 'user',
      content: 'How do I optimize a business rule?',
    });
  });

  it('forwards previousResponseId for thread continuation', async () => {
    await openaiAdapter.reply({
      modelRef: { provider: 'openai', modelId: 'gpt-5-mini' },
      systemInstructions: '',
      userPrompt: 'follow up',
      contextMessages: [],
      knowledge: { mode: 'none' },
      maxOutputTokens: 500,
      clarificationPolicy: 'ask_when_needed',
      previousResponseId: 'resp_prev',
    });
    const callArgs = create.mock.calls[0]?.[0] as any;
    expect(callArgs.previous_response_id).toBe('resp_prev');
    expect(callArgs.tools).toBeUndefined();
  });

  it('throws when hosted_file_search has no vector store id', async () => {
    await expect(
      openaiAdapter.reply({
        modelRef: { provider: 'openai', modelId: 'gpt-5-mini' },
        systemInstructions: '',
        userPrompt: 'x',
        contextMessages: [],
        knowledge: { mode: 'hosted_file_search', vectorStoreIds: [] },
        maxOutputTokens: 100,
        clarificationPolicy: 'ask_when_needed',
      }),
    ).rejects.toThrow(/no OpenAI vector store id/);
  });
});
