import { describe, expect, it } from '@jest/globals';
import { normalizeTenantSlug } from './tenant-slug.js';

describe('normalizeTenantSlug', () => {
  it('normalizes valid tenant slugs', () => {
    expect(normalizeTenantSlug(' MyTenant ')).toBe('mytenant');
    expect(normalizeTenantSlug('my-tenant-01')).toBe('my-tenant-01');
  });

  it('rejects invalid slug values', () => {
    expect(() => normalizeTenantSlug('ab')).toThrow();
    expect(() => normalizeTenantSlug('bad slug')).toThrow();
    expect(() => normalizeTenantSlug('-leading')).toThrow();
    expect(() => normalizeTenantSlug('trailing-')).toThrow();
  });
});
