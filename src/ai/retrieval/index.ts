import { RetrievalUnavailableError } from '../../util/errors.js';
import type { RetrievalMode } from '../../assistants/types.js';
import type { KnowledgeRef, ResolvedRole } from '../types.js';

export function buildKnowledgeRef(
  retrievalMode: RetrievalMode,
  resolved: ResolvedRole,
): KnowledgeRef {
  switch (retrievalMode) {
    case 'none':
      return { mode: 'none' };
    case 'instructions_only':
      return { mode: 'instructions_only' };
    case 'hosted_file_search':
      if (resolved.vectorStoreIds.length === 0) {
        throw new RetrievalUnavailableError(
          'hosted_file_search',
          'no vector store id configured - run `npm run upload-knowledge <assistant-id>` and set the env var',
        );
      }
      return { mode: 'hosted_file_search', vectorStoreIds: resolved.vectorStoreIds };
    case 'rag':
      throw new RetrievalUnavailableError(
        'rag',
        'self-managed RAG is not implemented in this build; use hosted_file_search',
      );
  }
}
