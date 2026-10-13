import { validateEnvironment } from './validate-environment.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://app:secret@localhost:5432/balootorg',
  JWT_ACCESS_SECRET: 'development-access-secret',
  JWT_REFRESH_SECRET: 'development-refresh-secret',
  RESEND_API_KEY: 'resend-test-key',
  RESEND_FROM_EMAIL: 'noreply@example.test',
  APP_URL: 'http://localhost:4000/api',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('validateEnvironment', () => {
  it('applies safe defaults for operational settings', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      APP_PORT: 4000,
      AUTH_RATE_LIMIT: 5,
      AUTH_RATE_TTL_MS: 60_000,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it('reports missing keys without echoing provided secret values', () => {
    let errorMessage = '';
    try {
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'do-not-print-this-secret',
        FRONTEND_URL: undefined,
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toMatch(/FRONTEND_URL is required/);
    expect(errorMessage).not.toContain('do-not-print-this-secret');
  });

  it('rejects invalid URLs, ports, and rate-limit settings', () => {
    let errorMessage = '';
    try {
      validateEnvironment({
        ...validEnvironment,
        APP_PORT: '70000',
        AUTH_RATE_LIMIT: '0',
        FRONTEND_URL: 'javascript:alert(1)',
      });
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toContain('APP_PORT');
    expect(errorMessage).toContain('AUTH_RATE_LIMIT');
    expect(errorMessage).toContain('FRONTEND_URL');
  });

  it('requires strong secrets and HTTPS URLs in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow(/JWT_ACCESS_SECRET.*JWT_REFRESH_SECRET.*APP_URL.*FRONTEND_URL/);
  });
});
