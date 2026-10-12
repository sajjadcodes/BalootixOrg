import { jest } from '@jest/globals';
import { PlatformAdminService } from './platform-admin.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('PlatformAdminService', () => {
  const tenantAll = jest.fn<
    () => Promise<
      {
        id: string;
        slug: string;
        name: string;
        status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
        createdAt: string;
        updatedAt: string;
      }[]
    >
  >();
  const tenantCount = jest.fn(async () => 0);
  const tenantQuery = {
    all: tenantAll,
    count: tenantCount,
    where: jest.fn(() => tenantQuery),
    orderBy: jest.fn(() => tenantQuery),
    limit: jest.fn(() => tenantQuery),
    offset: jest.fn(() => tenantQuery),
  };
  const tenantWhere = jest.fn(() => tenantQuery);
  const userAll = jest.fn<
    () => Promise<
      {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        mobile: string | null;
        isManager: boolean;
        emailVerifiedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }[]
    >
  >();
  const userCount = jest.fn(async () => 0);
  const userQuery = {
    all: userAll,
    count: userCount,
    where: jest.fn(() => userQuery),
    orderBy: jest.fn(() => userQuery),
    limit: jest.fn(() => userQuery),
    offset: jest.fn(() => userQuery),
  };
  const userWhere = jest.fn(() => userQuery);

  const prisma = {
    public: {
      Tenant: { where: tenantWhere },
      User: { where: userWhere },
    },
  };

  let service: PlatformAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantCount.mockReset().mockResolvedValue(0);
    userCount.mockReset().mockResolvedValue(0);
    service = new PlatformAdminService(prisma as unknown as PrismaService);
  });

  it('filters tenant listings by status when the platform admin supplies one', async () => {
    const rows = [
      {
        id: 'tenant-1',
        slug: 'acme',
        name: 'Acme',
        status: 'ACTIVE' as const,
        createdAt: '2026-10-10T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
      },
    ];

    tenantAll.mockResolvedValue(rows);

    tenantCount.mockResolvedValue(1);

    await expect(service.listTenants({ status: 'ACTIVE' })).resolves.toEqual({
      items: [
        {
          id: 'tenant-1',
          slug: 'acme',
          name: 'Acme',
          status: 'ACTIVE',
          createdAt: '2026-10-10T00:00:00.000Z',
          updatedAt: '2026-10-10T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    expect(tenantWhere).toHaveBeenCalledWith({});
    expect(tenantQuery.where).toHaveBeenCalledWith(expect.any(Function));
    expect(tenantQuery.limit).toHaveBeenCalledWith(25);
  });

  it('maps tenant users into the public response shape', async () => {
    const rows = [
      {
        id: 'user-1',
        email: 'ops@example.com',
        displayName: 'Ops',
        avatarUrl: null,
        mobile: null,
        isManager: true,
        emailVerifiedAt: '2026-10-10T00:00:00.000Z',
        createdAt: '2026-10-10T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
      },
    ];

    userAll.mockResolvedValue(rows);

    userCount.mockResolvedValue(1);

    await expect(service.listTenantUsers('tenant-1')).resolves.toMatchObject({
      items: [
        {
          id: 'user-1',
          email: 'ops@example.com',
          displayName: 'Ops',
          avatarUrl: null,
          mobile: null,
          isManager: true,
          emailVerifiedAt: '2026-10-10T00:00:00.000Z',
          createdAt: '2026-10-10T00:00:00.000Z',
          updatedAt: '2026-10-10T00:00:00.000Z',
        },
      ],
      pagination: { total: 1, page: 1, pageSize: 25 },
    });
    expect(userWhere).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(userQuery.limit).toHaveBeenCalledWith(25);
  });
});
