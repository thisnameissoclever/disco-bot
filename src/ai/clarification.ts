import type { ClarificationPolicy } from '../config/types.js';

const SNIPPETS: Record<ClarificationPolicy, string> = {
  ask_when_needed: [
    'Clarification policy: ask the smallest number of clarifying questions needed when missing details would prevent a good answer.',
    'Explain which missing detail you need.',
    'When the available context is sufficient, answer directly. Do not ask clarifying questions as a default ritual.',
  ].join(' '),
  never_ask: [
    'Clarification policy: never ask follow-up questions.',
    'If a detail is unclear, state a single explicit assumption and continue.',
  ].join(' '),
  always_ask: [
    'Clarification policy: always begin by asking the single most useful clarifying question, then wait for the user reply before providing a substantive answer.',
  ].join(' '),
};

export function clarificationSnippet(policy: ClarificationPolicy): string {
  return SNIPPETS[policy];
}
