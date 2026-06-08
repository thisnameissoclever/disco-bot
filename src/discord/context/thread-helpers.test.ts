import { describe, expect, it } from 'vitest';
import { chunkMessage } from './thread-helpers.js';

describe('chunkMessage', () => {
  it('returns one chunk for short text', () => {
    expect(chunkMessage('hello', 100)).toEqual(['hello']);
  });

  it('splits long text below the max length', () => {
    const text = 'a'.repeat(250);
    const chunks = chunkMessage(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(100);
    }
    expect(chunks.join('')).toBe(text);
  });

  it('prefers splitting on newlines', () => {
    const text = ['paragraph one', 'paragraph two', 'paragraph three'].join('\n').repeat(10);
    const chunks = chunkMessage(text, 60);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(60);
    }
    expect(chunks.join('\n').replace(/\n+/g, '\n')).toBe(text.replace(/\n+/g, '\n'));
  });
});
