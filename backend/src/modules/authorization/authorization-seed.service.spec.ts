import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AUTHORIZATION_PERMISSION_KEY } from './decorators/require-permission.decorator.js';
import { collectAuthorizationSeedPermissions } from './authorization-seed-catalog.js';
import {
  AuthorizationSeedService,
  type SeedPermission,
} from './authorization-seed.service.js';

type MemoryRow = Record<string, unknown> & { id: string };

function createMemoryTable(initialRows: MemoryRow[] = []) {
  const rows = [...initialRows];
  let nextId = 0;

  return {
    rows,
    where(filter: Record<string, unknown>) {
      const matchingRows = () =>
        rows.filter((row) =>
          Object.entries(filter).every(([key, value]) => row[key] === value),
        );

      return {
        first: jest.fn(async () => matchingRows()[0] ?? null),
        all: jest.fn(async () => matchingRows()),
      };
    },
    create: jest.fn(async (data: Record<string, unknown>) => {
      const row = { ...data, id: `seeded-${++nextId}` } as MemoryRow;
      rows.push(row);
      return row;
    }),
  };
}

describe('AuthorizationSeedService', () => {
  it('collects distinct route and action pairs from permission decorators', () => {
    class ExampleController {
      protectedRoute(): void {}

      duplicateRoute(): void {}

      publicRoute(): void {}
    }

    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSION_KEY,
      { resource: '/units', action: 'READ' },
      ExampleController.prototype.protectedRoute,
    );
    Reflect.defineMetadata(
      AUTHORIZATION_PERMISSION_KEY,
      { resource: '/units', action: 'READ' },
      ExampleController.prototype.duplicateRoute,
    );

    const permissions = collectAuthorizationSeedPermissions(
      [ExampleController],
      AUTHORIZATION_PERMISSION_KEY,
    );

    expect(permissions).toContainEqual({
      resource: '/units',
      action: 'READ',
    });
    expect(permissions).toHaveLength(1);
    expect(
      new Set(
        permissions.map(({ resource, action }) => `${resource}\0${action}`),
      ).size,
    ).toBe(permissions.length);
  });

  it('seeds routes and permissions idempotently per tenant without creating roles', async () => {
    const tenants = createMemoryTable([
      { id: 'tenant-a', name: 'Tenant A' },
      { id: 'tenant-b', name: 'Tenant B' },
    ]);
    const resources = createMemoryTable();
    const permissions = createMemoryTable();
    const publicModels = {
      Tenant: tenants,
      Resource: resources,
      Permission: permissions,
    };
    const prisma = {
      client: {
        transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ orm: { public: publicModels } }),
      },
    };
    const service = new AuthorizationSeedService(
      prisma as unknown as PrismaService,
    );

    const catalog: SeedPermission[] = [
      { resource: '/users', action: 'READ' },
      { resource: '/users/:id', action: 'UPDATE' },
      { resource: '/units', action: 'CREATE' },
    ];
    const expectedResourceCount = new Set(
      catalog.map(({ resource }) => resource),
    ).size;

    await service.seedTenant('tenant-a', catalog);
    await service.seedTenant('tenant-a', catalog);
    await service.seedTenant('tenant-b', catalog);

    expect(resources.rows).toHaveLength(expectedResourceCount * 2);
    expect(permissions.rows).toHaveLength(catalog.length * 2);
    expect(
      resources.rows.every((resource) =>
        ['tenant-a', 'tenant-b'].includes(String(resource.tenantId)),
      ),
    ).toBe(true);
    expect(
      permissions.rows.every((permission) =>
        ['tenant-a', 'tenant-b'].includes(String(permission.tenantId)),
      ),
    ).toBe(true);
  });

  it('refuses to seed an unknown tenant', async () => {
    const tenants = createMemoryTable();
    const resources = createMemoryTable();
    const permissions = createMemoryTable();
    const prisma = {
      client: {
        transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            orm: {
              public: {
                Tenant: tenants,
                Resource: resources,
                Permission: permissions,
              },
            },
          }),
      },
    };
    const service = new AuthorizationSeedService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.seedTenant('missing-tenant', [
        { resource: '/users', action: 'READ' },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resources.rows).toHaveLength(0);
    expect(permissions.rows).toHaveLength(0);
  });
});
