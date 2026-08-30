process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'agm-test-only-jwt-secret-never-use-in-production';
process.env.DATABASE_URL ??= 'postgresql://agm_test:agm_test@127.0.0.1:5432/agm_test?schema=public';
process.env.OPENAI_API_KEY ??= 'agm-test-only-openai-key-never-use-externally';
process.env.PRISMA_CONNECT_ON_BOOT = 'false';
process.env.AGM_SOURCE_FRESHNESS_SCHEDULER_ENABLED = 'false';
