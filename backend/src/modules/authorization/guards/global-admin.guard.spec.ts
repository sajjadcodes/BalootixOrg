import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { GlobalAdminGuard } from './global-admin.guard.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';

describe('GlobalAdminGuard', () => {
  const globalAdminLookup =
    jest.fn<() => Promise<{ email: string; isActive: boolean } | null>>();

  const prisma = {
    public: {
      GlobalAdmin: {
        where: jest.fn(() => ({ first: globalAdminLookup })),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    globalAdminLookup.mockReset();
  });

  it('allows active platform admins', async () => {
    const guard = new GlobalAdminGuard(prisma as unknown as PrismaService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { email: 'ops@example.com' } }),
      }),
    } as ExecutionContext;

    globalAdminLookup.mockResolvedValue({
      email: 'ops@example.com',
      isActive: true,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks tenant users who are not active platform admins', async () => {
    const guard = new GlobalAdminGuard(prisma as unknown as PrismaService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { email: 'tenant@example.com' } }),
      }),
    } as ExecutionContext;

    globalAdminLookup.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
