// Test environment defaults. Loaded by vitest before any user code runs.
// These values let modules that call loadEnv() succeed during unit tests.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? 'test-discord-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? 'test-client-id';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/test?sslmode=disable';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'sk-test';
