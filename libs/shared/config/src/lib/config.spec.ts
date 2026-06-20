import { loadAppConfig } from './env.schema';

describe('loadAppConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads development defaults', () => {
    process.env['NODE_ENV'] = 'development';
    const config = loadAppConfig();

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toContain('postgresql://');
    expect(config.redisUrl).toContain('redis://');
  });
});
