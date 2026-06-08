import { describe, expect, it } from 'vitest';
import { CONFIG_REGISTRY, getConfigEntry, validateConfigValue } from './registry.js';

describe('CONFIG_REGISTRY', () => {
  it('has exactly 44 keys (matches Required Per-Server Config Options)', () => {
    expect(CONFIG_REGISTRY.length).toBe(44);
  });

  it('has unique keys', () => {
    const keys = CONFIG_REGISTRY.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every key has either guild or guild_assistant scope', () => {
    for (const e of CONFIG_REGISTRY) {
      expect(['guild', 'guild_assistant']).toContain(e.scope);
    }
  });

  it('all defaults pass their own schema', () => {
    for (const e of CONFIG_REGISTRY) {
      const result = e.schema.safeParse(e.default);
      if (!result.success) {
        throw new Error(`Default for ${e.key} fails its schema: ${result.error.message}`);
      }
    }
  });

  it('validateConfigValue rejects unknown keys', () => {
    const r = validateConfigValue('not_a_key', 1);
    expect(r.ok).toBe(false);
  });

  it('validateConfigValue accepts a valid emoji', () => {
    const r = validateConfigValue('point_award_emoji', '+');
    expect(r.ok).toBe(true);
  });

  it('validateConfigValue rejects an over-large budget', () => {
    const r = validateConfigValue('point_budget_per_user', 9999);
    expect(r.ok).toBe(false);
  });

  it('the audit log channel accepts null', () => {
    const r = validateConfigValue('audit_log_channel', null);
    expect(r.ok).toBe(true);
  });

  it('the audit log channel rejects bad snowflakes', () => {
    const r = validateConfigValue('audit_log_channel', 'abc');
    expect(r.ok).toBe(false);
  });

  it('model refs require provider + modelId', () => {
    const ok = validateConfigValue('primary_model', { provider: 'openai', modelId: 'gpt-5-mini' });
    expect(ok.ok).toBe(true);
    const bad = validateConfigValue('primary_model', { provider: 'unknown', modelId: 'gpt-5-mini' });
    expect(bad.ok).toBe(false);
  });

  it('reaction removal behavior is enumerated', () => {
    const entry = getConfigEntry('reaction_removal_behavior');
    expect(entry?.allowedValues).toContain('revoke_within_1_hour');
  });
});
