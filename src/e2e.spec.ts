import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from './modules/auth/auth.service.js';
import { OwnerBootstrapService } from './modules/auth/owner-bootstrap.service.js';
import { PlatformAdminService } from './modules/platform-admin/platform-admin.service.js';
import { normalizeTenantSlug } from './modules/platform-admin/tenant-slug.js';

const createDate = () => new Date('2026-10-01T00:00:00.000Z').toISOString();

function createMockPrisma() {
  const state: any = {
    tenants: [
      {
        id: 'tenant-default',
        slug: 'default-tenant',
        name: 'Default Tenant',
        status: 'ACTIVE' as const,
        createdAt: createDate(),
        updatedAt: createDate(),
      },
    ],
    users: [
      {
        id: 'user-owner',
        tenantId: 'tenant-default',
        email: 'owner@balootorg.test',
        displayName: 'Owner',
        hashedPassword:
          '$2b$12$8nKXQ4J0Eri4v0Z9E2EgnOnz0h8ZW89v2a2dP9U1a8g2jL6yNC4iW',
        isManager: true,
        mobile: null,
        avatarUrl: null,
        emailVerifiedAt: createDate(),
        refreshTokenHash: null,
        createdAt: createDate(),
        updatedAt: createDate(),
      },
    ],
    emailVerificationTokens: [],
    ownerSetupTokens: [],
    roles: [],
    units: [],
    roleAssignments: [],
  };

  const pick = (record: Record<string, unknown>, fields: string[]) => {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in record) {
        result[field] = record[field];
      }
    }
    return result;
  };

  const proxiedRecord = (record: Record<string, unknown>) =>
    new Proxy(record, {
      get: (target, prop: string | symbol) => {
        const value = target[prop as keyof typeof target];
        if (typeof prop === 'symbol') {
          return value;
        }

        return {
          eq: (expected: unknown) => value === expected,
          gt: (expected: unknown) => String(value) > String(expected),
          isNull: () => value === null,
          notNull: () => value !== null,
        };
      },
    });

  const matchesObjectFilter = (
    record: Record<string, unknown>,
    filters: Record<string, unknown>,
  ) =>
    Object.entries(filters).every(([key, value]) => {
      if (typeof value === 'function') {
        const propertyValue =
          proxiedRecord(record)[key as keyof ReturnType<typeof proxiedRecord>];
        return value(propertyValue);
      }
      return record[key] === value;
    });

  const combineFilters = (
    left:
      | Record<string, unknown>
      | ((record: Record<string, unknown>) => boolean)
      | undefined,
    right:
      | Record<string, unknown>
      | ((record: Record<string, unknown>) => boolean)
      | undefined,
  ) => {
    if (!left) return right;
    if (!right) return left;

    if (typeof left === 'function' && typeof right === 'function') {
      return (record: Record<string, unknown>) => left(record) && right(record);
    }

    if (typeof left === 'function') {
      return (record: Record<string, unknown>) =>
        left(record) &&
        matchesObjectFilter(record, right as Record<string, unknown>);
    }

    if (typeof right === 'function') {
      return (record: Record<string, unknown>) =>
        matchesObjectFilter(record, left as Record<string, unknown>) &&
        right(record);
    }

    return (record: Record<string, unknown>) =>
      matchesObjectFilter(record, left as Record<string, unknown>) &&
      matchesObjectFilter(record, right as Record<string, unknown>);
  };

  const filterRecords = (
    records: Record<string, unknown>[],
    filters:
      Record<string, unknown> | ((record: Record<string, unknown>) => boolean),
  ) => {
    if (typeof filters === 'function') {
      return records.filter((record) => filters(proxiedRecord(record)));
    }

    return records.filter((record) => matchesObjectFilter(record, filters));
  };

  const makeQuery = (
    collection: Record<string, unknown>[],
    filters:
      | Record<string, unknown>
      | ((record: Record<string, unknown>) => boolean) = {},
  ) => {
    const results = filterRecords(collection, filters);

    const query = {
      where: (
        nextFilters:
          | Record<string, unknown>
          | ((record: Record<string, unknown>) => boolean) = {},
      ) => makeQuery(collection, combineFilters(filters, nextFilters)),
      orderBy: () => makeQuery(collection, filters),
      limit: () => query,
      offset: () => query,
      count: async () => results.length,
      first: async () => results[0] ?? null,
      all: async () => [...results],
      update: async (changes: Record<string, unknown>) => {
        const updated = results.map((record) => ({ ...record, ...changes }));
        for (let index = 0; index < updated.length; index += 1) {
          const source = results[index];
          const sourceIndex = collection.indexOf(source);
          if (sourceIndex >= 0) {
            collection[sourceIndex] = updated[index];
          }
        }
        return updated[0] ?? null;
      },
      updateAll: async (changes: Record<string, unknown>) => {
        const updated = results.map((record) => ({ ...record, ...changes }));
        for (let index = 0; index < updated.length; index += 1) {
          const source = results[index];
          const sourceIndex = collection.indexOf(source);
          if (sourceIndex >= 0) {
            collection[sourceIndex] = updated[index];
          }
        }
        return updated;
      },
      create: async (input: Record<string, unknown>) => {
        const created = {
          id: `${collection.length + 1}`,
          createdAt: createDate(),
          updatedAt: createDate(),
          ...input,
        } as Record<string, unknown>;
        collection.push(created);
        return created;
      },
      select: (...fields: string[]) => ({
        first: async () => (results[0] ? pick(results[0], fields) : null),
        all: async () => results.map((record) => pick(record, fields)),
      }),
    };

    return query;
  };

  const Tenant = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(state.tenants, filters),
    orderBy: () => ({
      first: async () => state.tenants[0] ?? null,
    }),
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `tenant-${state.tenants.length + 1}`,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.tenants.push(created);
      return created;
    },
  };

  const User = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(state.users, filters),
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `user-${state.users.length + 1}`,
        emailVerifiedAt: null,
        mobile: null,
        avatarUrl: null,
        refreshTokenHash: null,
        isManager: false,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.users.push(created);
      return created;
    },
  };

  const EmailVerificationToken = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(state.emailVerificationTokens, filters),
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `ev-${state.emailVerificationTokens.length + 1}`,
        usedAt: null,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.emailVerificationTokens.push(created);
      return created;
    },
  };

  const OwnerSetupToken = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(state.ownerSetupTokens, filters),
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `setup-${state.ownerSetupTokens.length + 1}`,
        usedAt: null,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.ownerSetupTokens.push(created);
      return created;
    },
  };

  const Role = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(state.roles, filters),
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `role-${state.roles.length + 1}`,
        isActive: true,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.roles.push(created);
      return created;
    },
  };

  const Unit = {
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `unit-${state.units.length + 1}`,
        isActive: true,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.units.push(created);
      return created;
    },
  };

  const RoleAssignment = {
    create: async (input: Record<string, unknown>) => {
      const created = {
        id: `ra-${state.roleAssignments.length + 1}`,
        isActive: true,
        createdAt: createDate(),
        updatedAt: createDate(),
        ...input,
      } as Record<string, unknown>;
      state.roleAssignments.push(created);
      return created;
    },
  };

  const GlobalAdmin = {
    where: (filters: Record<string, unknown> = {}) =>
      makeQuery(
        [{ email: 'platform@balootorg.test', isActive: true, id: 'ga-1' }],
        filters,
      ),
  };

  const publicApi = {
    Tenant,
    User,
    EmailVerificationToken,
    OwnerSetupToken,
    Role,
    Unit,
    RoleAssignment,
    GlobalAdmin,
  };

  return {
    prisma: {
      public: publicApi,
      client: {
        transaction: async (
          callback: (tx: {
            orm: { public: typeof publicApi };
          }) => Promise<unknown>,
        ) => callback({ orm: { public: publicApi } }),
      },
    },
    state,
  };
}

describe('E2E backend coverage', () => {
  let config: ConfigService;
  let emailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
    sendOwnerSetupEmail: jest.Mock;
  };
  let prisma: ReturnType<typeof createMockPrisma>['prisma'];
  let state: ReturnType<typeof createMockPrisma>['state'];
  let authService: AuthService;
  let ownerBootstrapService: OwnerBootstrapService;
  let platformAdminService: PlatformAdminService;

  beforeEach(() => {
    jest.clearAllMocks();

    const initialized = createMockPrisma();
    prisma = initialized.prisma;
    state = initialized.state;

    config = new ConfigService({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/balootorg_test',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM_EMAIL: 'noreply@balootorg.test',
      APP_URL: 'https://api.balootorg.test',
      FRONTEND_URL: 'https://app.balootorg.test',
    });

    emailService = {
      sendVerificationEmail: jest.fn(async () => undefined),
      sendPasswordResetEmail: jest.fn(async () => undefined),
      sendOwnerSetupEmail: jest.fn(async () => undefined),
    };

    const jwtService = new JwtService();
    authService = new AuthService(
      emailService as never,
      jwtService,
      config,
      prisma as never,
    );
    ownerBootstrapService = new OwnerBootstrapService(
      prisma as never,
      emailService as never,
    );
    platformAdminService = new PlatformAdminService(prisma as never);
  });

  it('A: owner bootstrap creates a reserved OWNER account and platform tenant', async () => {
    state.tenants = [];

    await ownerBootstrapService.issueSetupInvite({
      email: 'platform-owner@balootorg.test',
      displayName: 'Platform Owner',
    });

    const setupToken = emailService.sendOwnerSetupEmail.mock.calls[0]?.[1];
    expect(setupToken).toBeTruthy();

    await expect(
      ownerBootstrapService.completeSetup({
        token: setupToken as string,
        password: 'StrongPassword123!',
      }),
    ).resolves.toEqual({ completed: true });

    const tenant = state.tenants.find(
      (entry) => entry.name === 'Platform Tenant',
    );
    expect(tenant).toBeTruthy();
    expect(state.roles.some((entry) => entry.systemKey === 'OWNER')).toBe(true);
  });

  it('B: registers, verifies, logs in, reads me, refreshes, and logs out', async () => {
    const registration = await authService.registerWithEmailPassword({
      email: 'new.user@balootorg.test',
      password: 'StrongPassword123!',
      displayName: 'New User',
    });

    expect(registration.email).toBe('new.user@balootorg.test');

    const verificationToken = emailService.sendVerificationEmail.mock
      .calls[0]?.[1] as string;
    expect(verificationToken).toBeTruthy();

    await authService.verifyEmail(verificationToken);

    const login = await authService.loginWithEmailPassword({
      email: 'new.user@balootorg.test',
      password: 'StrongPassword123!',
    });

    expect(login.user.email).toBe('new.user@balootorg.test');
    expect(login.tokens.accessToken).toBeTruthy();
    expect(login.tokens.refreshToken).toBeTruthy();

    const currentUser = await authService.getCurrentUser(login.user.id);
    expect(currentUser.email).toBe('new.user@balootorg.test');

    const refreshed = await authService.refresh(
      login.user.id,
      login.tokens.refreshToken,
    );
    expect(refreshed.tokens.accessToken).toBeTruthy();
    expect(refreshed.tokens.refreshToken).toBeTruthy();

    await expect(
      authService.logout(login.user.id, refreshed.tokens.refreshToken),
    ).resolves.toBeUndefined();
  }, 30_000);

  it('C: forgot-password and reset-password flows work end-to-end', async () => {
    await authService.registerWithEmailPassword({
      email: 'reset.user@balootorg.test',
      password: 'Password123!',
      displayName: 'Reset User',
    });

    const verificationToken = emailService.sendVerificationEmail.mock
      .calls[0]?.[1] as string;
    await authService.verifyEmail(verificationToken);

    await authService.forgotPassword({ email: 'reset.user@balootorg.test' });

    const resetToken = emailService.sendPasswordResetEmail.mock
      .calls[0]?.[1] as string;
    expect(resetToken).toBeTruthy();

    await expect(
      authService.resetPassword({
        token: resetToken,
        password: 'ResetPassword456!',
      }),
    ).resolves.toEqual({ reset: true });

    const login = await authService.loginWithEmailPassword({
      email: 'reset.user@balootorg.test',
      password: 'ResetPassword456!',
    });

    expect(login.user.email).toBe('reset.user@balootorg.test');
  }, 30_000);

  it('D: invalid and normalized tenant slugs are rejected and accepted correctly', () => {
    expect(normalizeTenantSlug(' MyTenant ')).toBe('mytenant');
    expect(normalizeTenantSlug('my-tenant-01')).toBe('my-tenant-01');

    expect(() => normalizeTenantSlug('ab')).toThrow();
    expect(() => normalizeTenantSlug('bad slug')).toThrow();
    expect(() => normalizeTenantSlug('-leading')).toThrow();
    expect(() => normalizeTenantSlug('trailing-')).toThrow();
    expect(() => normalizeTenantSlug('double--dash')).toThrow();
  });

  it('E: platform-admin listing returns tenant metadata and tenant users', async () => {
    await authService.registerWithEmailPassword({
      email: 'tenant-user@balootorg.test',
      password: 'Password123!',
      displayName: 'Tenant User',
    });

    const verificationToken = emailService.sendVerificationEmail.mock
      .calls[0]?.[1] as string;
    await authService.verifyEmail(verificationToken);

    const tenants = await platformAdminService.listTenants({
      status: 'ACTIVE',
    });
    expect(
      tenants.items.some((tenant) => tenant.slug === 'default-tenant'),
    ).toBe(true);

    const tenantUsers =
      await platformAdminService.listTenantUsers('tenant-default');
    expect(
      tenantUsers.items.some(
        (user) => user.email === 'tenant-user@balootorg.test',
      ),
    ).toBe(true);
  });

  it('F: tenant isolation and unauthorized access are fail-closed', async () => {
    const firstTenant = (await prisma.public.Tenant.create({
      slug: 'tenant-alpha',
      name: 'Alpha',
      status: 'ACTIVE',
    })) as { id: string };

    await prisma.public.Tenant.create({
      slug: 'tenant-beta',
      name: 'Beta',
      status: 'ACTIVE',
    });

    await prisma.public.User.create({
      tenantId: firstTenant.id,
      email: 'alpha@balootorg.test',
      displayName: 'Alpha User',
      hashedPassword: 'hashed',
      isManager: false,
    });

    const tenantUsers = await platformAdminService.listTenantUsers(
      String(firstTenant.id),
    );
    expect(
      tenantUsers.items.every((user) => user.email !== 'beta@balootorg.test'),
    ).toBe(true);

    await expect(
      authService.loginWithEmailPassword({
        email: 'missing@balootorg.test',
        password: 'Nope!',
      }),
    ).rejects.toThrow('Invalid credentials');
  });
});
