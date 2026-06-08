import { describe, expect, it } from 'vitest';
import { clarificationSnippet } from './clarification.js';

describe('clarificationSnippet', () => {
  it('ask_when_needed mentions answering directly when context is sufficient', () => {
    const s = clarificationSnippet('ask_when_needed');
    expect(s).toMatch(/answer directly/i);
    expect(s).toMatch(/smallest number/i);
  });
  it('never_ask tells the model not to ask', () => {
    const s = clarificationSnippet('never_ask');
    expect(s).toMatch(/never ask/i);
  });
  it('always_ask requires one clarifying question first', () => {
    const s = clarificationSnippet('always_ask');
    expect(s).toMatch(/clarifying question/i);
  });
});
