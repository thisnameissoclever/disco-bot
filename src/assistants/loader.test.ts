import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAssistantsFromDisk } from './loader.js';

function writeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'disco-assistants-'));
  const dir = join(root, 'TestAssistant');
  mkdirSync(dir);
  writeFileSync(join(dir, 'instructions.md'), 'You are a test assistant.', 'utf8');
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      id: 'test-assistant',
      displayName: 'Test Assistant',
      description: 'desc',
      defaults: {
        primaryModel: { provider: 'openai', modelId: 'gpt-5-mini' },
        utilityModel: { provider: 'openai', modelId: 'gpt-5-nano' },
        escalationModel: { provider: 'openai', modelId: 'gpt-5' },
      },
    }),
    'utf8',
  );
  return root;
}

describe('loadAssistantsFromDisk', () => {
  it('parses a minimal valid manifest', async () => {
    const root = writeFixture();
    const defs = await loadAssistantsFromDisk(root);
    expect(defs.length).toBe(1);
    expect(defs[0]?.id).toBe('test-assistant');
    expect(defs[0]?.instructions).toContain('test assistant');
    expect(defs[0]?.defaults.primaryModel.modelId).toBe('gpt-5-mini');
    expect(defs[0]?.clarificationPolicy).toBe('ask_when_needed');
  });

  it('returns empty when the directory does not exist', async () => {
    const defs = await loadAssistantsFromDisk('/tmp/does-not-exist-disco-1234567');
    expect(defs).toEqual([]);
  });
});
