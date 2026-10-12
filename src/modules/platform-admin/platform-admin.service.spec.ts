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
  const tenantWhere = jest.fn(() => ({ all: tenantAll }));
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
  const userWhere = jest.fn(() => ({ all: userAll }));

  const prisma = {
    public: {
      Tenant: { where: tenantWhere },
      User: { where: userWhere },
    },
  };

  let service: PlatformAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
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

    await expect(service.listTenants('ACTIVE')).resolves.toEqual([
      {
        id: 'tenant-1',
        slug: 'acme',
        name: 'Acme',
        status: 'ACTIVE',
        createdAt: '2026-10-10T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
      },
    ]);

    expect(tenantWhere).toHaveBeenCalledWith({ status: 'ACTIVE' });
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

    await expect(service.listTenantUsers('tenant-1')).resolves.toEqual([
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
    ]);
  });
});
