import { describe, expect, it } from 'vitest';
import { emojiKey, emojiMatches } from './awards.js';

interface FakeEmoji {
  id: string | null;
  name: string | null;
  animated?: boolean;
}
type FakeReaction = { emoji: FakeEmoji };

const reaction = (emoji: FakeEmoji): FakeReaction => ({ emoji });

describe('emojiKey', () => {
  it('returns name for unicode emoji', () => {
    expect(emojiKey(reaction({ id: null, name: '+' }) as never)).toBe('+');
  });
  it('returns :name:id for custom emoji', () => {
    expect(emojiKey(reaction({ id: '123', name: 'helpful' }) as never)).toBe(':helpful:123');
  });
  it('marks animated custom emoji with leading a', () => {
    expect(emojiKey(reaction({ id: '123', name: 'helpful', animated: true }) as never))
      .toBe('a:helpful:123');
  });
});

describe('emojiMatches', () => {
  it('matches unicode emoji by name', () => {
    expect(emojiMatches(reaction({ id: null, name: '+' }) as never, '+')).toBe(true);
  });
  it('matches custom emoji by raw form', () => {
    expect(
      emojiMatches(reaction({ id: '123', name: 'helpful' }) as never, '<:helpful:123>'),
    ).toBe(true);
  });
  it('returns false when emoji differs', () => {
    expect(emojiMatches(reaction({ id: null, name: '+' }) as never, '-')).toBe(false);
  });
});
