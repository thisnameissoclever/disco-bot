import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { getLogger } from '../util/logger.js';
import type { AssistantDefinition } from './types.js';

// Resolve `assistants/` relative to the process cwd. This works in dev (run
// from repo root via tsx) and in the production Docker image (WORKDIR /app
// with assistants/ copied alongside dist/). An override via
// `ASSISTANTS_DIR` env var is honored for non-standard layouts.
const ASSISTANTS_ROOT = process.env.ASSISTANTS_DIR
  ? resolve(process.env.ASSISTANTS_DIR)
  : resolve(process.cwd(), 'assistants');

const modelRefSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  modelId: z.string().min(1),
});

const manifestSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  allowedServerFamilies: z.array(z.string()).default(['*']),
  instructionsFile: z.string().default('instructions.md'),
  knowledgeFiles: z.array(z.string()).default([]),
  defaults: z.object({
    provider: z.enum(['openai', 'anthropic', 'openrouter']).default('openai'),
    retrievalProvider: z.enum(['openai_file_search', 'self_managed_rag', 'none']).optional(),
    retrievalMode: z
      .enum(['none', 'instructions_only', 'hosted_file_search', 'rag'])
      .default('instructions_only'),
    primaryModel: modelRefSchema,
    utilityModel: modelRefSchema,
    escalationModel: modelRefSchema,
    embeddingModel: modelRefSchema.nullable().default(null),
    rerankModel: modelRefSchema.nullable().default(null),
    vectorStoreIdEnv: z.string().optional(),
    vectorStoreId: z.string().optional(),
  }),
  maxResponseLength: z.number().int().positive().default(3500),
  defaultCommand: z.string().default('ask'),
  allowedInvocationModes: z
    .array(z.enum(['slash', 'context_menu', 'mention', 'thread_continuation']))
    .default(['slash', 'context_menu', 'mention', 'thread_continuation']),
  safetyRules: z.array(z.string()).default([]),
  clarificationPolicy: z
    .enum(['ask_when_needed', 'never_ask', 'always_ask'])
    .default('ask_when_needed'),
});

export async function loadAssistantsFromDisk(
  rootDir: string = ASSISTANTS_ROOT,
): Promise<AssistantDefinition[]> {
  const logger = getLogger().child({ component: 'assistants' });
  let entries: string[];
  try {
    entries = await readdir(rootDir);
  } catch (err) {
    logger.warn({ rootDir, err }, 'assistants directory not found - starting with empty registry');
    return [];
  }

  const definitions: AssistantDefinition[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const dir = join(rootDir, name);
    const dirStat = await stat(dir).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    const manifestPath = join(dir, 'manifest.json');
    let raw: string;
    try {
      raw = await readFile(manifestPath, 'utf8');
    } catch {
      logger.warn({ dir }, 'skipping assistant folder (no manifest.json)');
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse manifest at ${manifestPath}: ${(err as Error).message}`);
    }

    const result = manifestSchema.safeParse(parsedJson);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new Error(`Invalid assistant manifest at ${manifestPath}: ${issues}`);
    }

    const manifest = result.data;
    const instructionsPath = join(dir, manifest.instructionsFile);
    let instructions: string;
    try {
      instructions = await readFile(instructionsPath, 'utf8');
    } catch (err) {
      throw new Error(
        `Assistant ${manifest.id} references instructions ${manifest.instructionsFile} which could not be read: ${(err as Error).message}`,
      );
    }

    const knowledgeAbs = manifest.knowledgeFiles.map((f) => join(dir, f));

    const vectorStoreId = manifest.defaults.vectorStoreId
      ?? (manifest.defaults.vectorStoreIdEnv
        ? process.env[manifest.defaults.vectorStoreIdEnv] ?? undefined
        : undefined);

    definitions.push({
      id: manifest.id,
      displayName: manifest.displayName,
      description: manifest.description,
      allowedServerFamilies: manifest.allowedServerFamilies,
      instructionsFile: manifest.instructionsFile,
      instructions,
      knowledgeFiles: manifest.knowledgeFiles,
      knowledgeFileAbsolutePaths: knowledgeAbs,
      defaults: {
        provider: manifest.defaults.provider,
        ...(manifest.defaults.retrievalProvider ? { retrievalProvider: manifest.defaults.retrievalProvider } : {}),
        retrievalMode: manifest.defaults.retrievalMode,
        primaryModel: manifest.defaults.primaryModel,
        utilityModel: manifest.defaults.utilityModel,
        escalationModel: manifest.defaults.escalationModel,
        embeddingModel: manifest.defaults.embeddingModel,
        rerankModel: manifest.defaults.rerankModel,
        ...(manifest.defaults.vectorStoreIdEnv ? { vectorStoreIdEnv: manifest.defaults.vectorStoreIdEnv } : {}),
        ...(vectorStoreId ? { vectorStoreId } : {}),
      },
      maxResponseLength: manifest.maxResponseLength,
      defaultCommand: manifest.defaultCommand,
      allowedInvocationModes: manifest.allowedInvocationModes,
      safetyRules: manifest.safetyRules,
      clarificationPolicy: manifest.clarificationPolicy,
      rootPath: dir,
    });
  }

  logger.info({ count: definitions.length }, 'loaded assistants');
  return definitions;
}
