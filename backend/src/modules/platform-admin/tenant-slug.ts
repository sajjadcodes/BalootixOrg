import { BadRequestException } from '@nestjs/common';

// It normalizes a tenant slug by converting it to lowercase,
// replacing non-alphanumeric characters with hyphens,
// and trimming leading/trailing hyphens.
// It also validates the slug to ensure it meets specific criteria.
export function normalizeTenantSlug(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new BadRequestException(
      'Tenant slug is required and must be 3-63 characters long.',
    );
  }

  const normalized = trimmed.toLowerCase();

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new BadRequestException(
      'Tenant slug may only contain lowercase letters, numbers, and hyphens.',
    );
  }

  if (
    normalized.startsWith('-') ||
    normalized.endsWith('-') ||
    normalized.includes('--') ||
    normalized.length < 3 ||
    normalized.length > 63
  ) {
    throw new BadRequestException(
      'Tenant slug must be 3-63 characters, may not start or end with a hyphen, and may not contain duplicate hyphens.',
    );
  }

  return normalized;
}
