const REQUIRED_ENVIRONMENT_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'APP_URL',
  'FRONTEND_URL',
] as const;

type Environment = Record<string, unknown>;

function isValidUrl(
  value: unknown,
  protocols: readonly string[],
): value is string {
  if (typeof value !== 'string') return false;

  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function readInteger(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
  errors: string[],
): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors.push(`${name} must be an integer from ${minimum} to ${maximum}`);
    return fallback;
  }
  return parsed;
}

export function validateEnvironment(environment: Environment): Environment {
  const errors: string[] = [];

  for (const key of REQUIRED_ENVIRONMENT_KEYS) {
    if (
      typeof environment[key] !== 'string' ||
      environment[key].trim().length === 0
    ) {
      errors.push(`${key} is required`);
    }
  }

  const nodeEnvironment = environment['NODE_ENV'] ?? 'development';
  if (
    !['development', 'test', 'production'].includes(String(nodeEnvironment))
  ) {
    errors.push('NODE_ENV must be development, test, or production');
  }

  if (!isValidUrl(environment['DATABASE_URL'], ['postgres:', 'postgresql:'])) {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL');
  }
  for (const key of ['APP_URL', 'FRONTEND_URL'] as const) {
    if (!isValidUrl(environment[key], ['http:', 'https:'])) {
      errors.push(`${key} must be a valid HTTP or HTTPS URL`);
    }
  }

  if (
    typeof environment['RESEND_FROM_EMAIL'] === 'string' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment['RESEND_FROM_EMAIL'])
  ) {
    errors.push('RESEND_FROM_EMAIL must be a valid email address');
  }

  const authRateLimit = readInteger(
    environment['AUTH_RATE_LIMIT'],
    5,
    'AUTH_RATE_LIMIT',
    1,
    1000,
    errors,
  );
  const authRateTtlMs = readInteger(
    environment['AUTH_RATE_TTL_MS'],
    60_000,
    'AUTH_RATE_TTL_MS',
    1000,
    86_400_000,
    errors,
  );
  const trustProxyHops = readInteger(
    environment['TRUST_PROXY_HOPS'],
    0,
    'TRUST_PROXY_HOPS',
    0,
    10,
    errors,
  );
  const appPort = readInteger(
    environment['APP_PORT'],
    4000,
    'APP_PORT',
    1,
    65_535,
    errors,
  );

  if (nodeEnvironment === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const secret = environment[key];
      if (typeof secret === 'string' && secret.length < 32) {
        errors.push(`${key} must contain at least 32 characters in production`);
      }
    }
    for (const key of ['APP_URL', 'FRONTEND_URL'] as const) {
      if (
        typeof environment[key] === 'string' &&
        !environment[key].startsWith('https://')
      ) {
        errors.push(`${key} must use HTTPS in production`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return {
    ...environment,
    NODE_ENV: nodeEnvironment,
    APP_PORT: appPort,
    AUTH_RATE_LIMIT: authRateLimit,
    AUTH_RATE_TTL_MS: authRateTtlMs,
    TRUST_PROXY_HOPS: trustProxyHops,
  };
}
