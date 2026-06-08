import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import OpenAI from 'openai';
import { AssistantRegistry } from '../src/assistants/registry.js';
import { getDb, schema } from '../src/db/client.js';
import { loadEnv } from '../src/env.js';
import { getLogger } from '../src/util/logger.js';

const log = getLogger().child({ component: 'upload-knowledge' });

interface CliArgs {
  assistantId: string;
  guildId?: string;
  envVarName?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error('Usage: tsx scripts/upload-knowledge.ts <assistant-id> [--guild=<id>] [--env=<NAME>]');
  }
  const assistantId = args[0]!;
  let guildId: string | undefined;
  let envVarName: string | undefined;
  for (const a of args.slice(1)) {
    if (a.startsWith('--guild=')) guildId = a.slice('--guild='.length);
    else if (a.startsWith('--env=')) envVarName = a.slice('--env='.length);
  }
  return { assistantId, guildId, envVarName } as CliArgs;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const { assistantId, guildId, envVarName } = parseArgs();
  const registry = await AssistantRegistry.fromDisk();
  const assistant = registry.get(assistantId);
  if (!assistant) throw new Error(`Unknown assistant id: ${assistantId}`);
  if (assistant.knowledgeFileAbsolutePaths.length === 0) {
    log.warn({ assistantId }, 'assistant has no knowledge files to upload');
    return;
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  log.info({ count: assistant.knowledgeFileAbsolutePaths.length }, 'uploading files to OpenAI');
  const fileIds: string[] = [];
  for (const path of assistant.knowledgeFileAbsolutePaths) {
    const stats = await stat(path);
    log.info({ path, bytes: stats.size }, 'upload');
    const file = await openai.files.create({
      file: createReadStream(path),
      purpose: 'assistants',
    });
    fileIds.push(file.id);
    log.info({ id: file.id }, 'file uploaded');
  }

  log.info('creating vector store');
  const vectorStore = await openai.vectorStores.create({
    name: `${assistant.id}-${Date.now()}`,
    file_ids: fileIds,
  });
  log.info({ id: vectorStore.id }, 'vector store created');

  log.info('waiting for indexing to complete');
  await waitForReady(openai, vectorStore.id);

  // Persist a provider_resources row so the bot has audit and lookup.
  const db = getDb();
  await db.insert(schema.providerResources).values({
    guildId: guildId ?? null,
    assistantId: assistant.id,
    provider: 'openai',
    resourceType: 'vector_store',
    resourceId: vectorStore.id,
    status: 'ready',
    metadata: { fileIds, fileCount: fileIds.length } as never,
  });

  log.info(
    {
      vectorStoreId: vectorStore.id,
      assistantId,
      envVarSuggestion: envVarName ?? assistant.defaults.vectorStoreIdEnv ?? null,
    },
    'success',
  );

  // Helpful echo for shell capture.
  console.log(`\nVECTOR_STORE_ID=${vectorStore.id}`);
  if (envVarName ?? assistant.defaults.vectorStoreIdEnv) {
      console.log(
      `# Set this in your environment:\n${envVarName ?? assistant.defaults.vectorStoreIdEnv}=${vectorStore.id}`,
    );
  }
}

async function waitForReady(openai: OpenAI, id: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    const store = await openai.vectorStores.retrieve(id);
    const fileCounts = (store as unknown as { file_counts?: { in_progress?: number; total?: number; completed?: number; failed?: number } }).file_counts;
    log.info(
      {
        status: store.status,
        completed: fileCounts?.completed ?? 0,
        inProgress: fileCounts?.in_progress ?? 0,
        failed: fileCounts?.failed ?? 0,
        total: fileCounts?.total ?? 0,
      },
      'index status',
    );
    if (store.status === 'completed') return;
    if (store.status === 'expired') throw new Error('vector store expired before indexing finished');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Timed out waiting for vector store indexing.');
}

void main().catch((err) => {
  log.fatal({ err }, 'upload-knowledge failed');
  process.exitCode = 1;
});
