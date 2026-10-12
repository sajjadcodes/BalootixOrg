import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from './users.service.js';
import type { UserData } from './types/user.js';

const user: UserData = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  mobile: null,
  isManager: false,
  emailVerifiedAt: null,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const userFirst = jest.fn(async () => null as UserData | null);
const userUpdate = jest.fn(async (_data: Record<string, unknown>) => user);
const userDelete = jest.fn(async () => user);
const userAll = jest.fn(async () => [] as UserData[]);
const userCount = jest.fn(async () => 0);
const userQuery = {
  first: userFirst,
  update: userUpdate,
  delete: userDelete,
  all: userAll,
  count: userCount,
  orderBy: jest.fn(() => userQuery),
  limit: jest.fn(() => userQuery),
  offset: jest.fn(() => userQuery),
  where: jest.fn(() => userQuery),
};
const userWhere = jest.fn(() => userQuery);
const roleAssignmentFirst = jest.fn(async () => null as { id: string } | null);
const roleAssignmentWhere = jest.fn(() => ({ first: roleAssignmentFirst }));

const prisma = {
  public: {
    User: {
      where: userWhere,
    },
    RoleAssignment: { where: roleAssignmentWhere },
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    userFirst.mockReset().mockResolvedValue(null);
    userUpdate.mockReset().mockResolvedValue(user);
    userDelete.mockReset().mockResolvedValue(user);
    userAll.mockReset().mockResolvedValue([]);
    userCount.mockReset().mockResolvedValue(0);
    userWhere.mockClear();
    userQuery.orderBy.mockClear();
    userQuery.limit.mockClear();
    userQuery.offset.mockClear();
    userQuery.where.mockClear();
    roleAssignmentFirst.mockReset().mockResolvedValue(null);
    roleAssignmentWhere.mockClear();

    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('lists a database-paginated user page within the current tenant', async () => {
    userAll.mockResolvedValueOnce([user]);
    userCount.mockResolvedValueOnce(1);

    await expect(service.listUsers('tenant-a')).resolves.toEqual({
      items: [user],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
    expect(userWhere).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(userAll).toHaveBeenCalledTimes(1);
    expect(userQuery.limit).toHaveBeenCalledWith(25);
    expect(userQuery.offset).toHaveBeenCalledWith(0);
  });

  it('caps large result sets and reports pagination boundaries', async () => {
    const pageItems = Array.from({ length: 100 }, (_, index) => ({
      ...user,
      id: `user-${index + 1}`,
    }));
    userAll.mockResolvedValueOnce(pageItems);
    userCount.mockResolvedValueOnce(25_000);

    const result = await service.listUsers('tenant-a', {
      page: 250,
      pageSize: 100,
      sortBy: 'email',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(100);
    expect(result.pagination).toEqual({
      page: 250,
      pageSize: 100,
      total: 25_000,
      totalPages: 250,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(userQuery.limit).toHaveBeenCalledWith(100);
    expect(userQuery.offset).toHaveBeenCalledWith(24_900);
  });

  it('returns an empty page with accurate metadata beyond the last page', async () => {
    userAll.mockResolvedValueOnce([]);
    userCount.mockResolvedValueOnce(51);

    await expect(
      service.listUsers('tenant-a', { page: 4, pageSize: 25 }),
    ).resolves.toMatchObject({
      items: [],
      pagination: {
        page: 4,
        pageSize: 25,
        total: 51,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    });
    expect(userQuery.limit).toHaveBeenCalledWith(25);
    expect(userQuery.offset).toHaveBeenCalledWith(75);
  });

  it('rejects unsupported sort and filter fields', async () => {
    await expect(
      service.listUsers('tenant-a', { sortBy: 'hashedPassword' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listUsers('tenant-a', { status: 'ACTIVE' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userAll).not.toHaveBeenCalled();
  });

  it('gets a user by id within the current tenant', async () => {
    userFirst.mockResolvedValueOnce(user);

    await expect(service.getUser(user.id, 'tenant-a')).resolves.toEqual(user);
    expect(userWhere).toHaveBeenCalledWith({
      id: user.id,
      tenantId: 'tenant-a',
    });
  });

  it('rejects missing user lookup', async () => {
    await expect(service.getUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a user without overwriting omitted fields', async () => {
    const updated = { ...user, displayName: 'Alice Smith' };

    userFirst.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    userUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateUser(user.id, {
        displayName: ' Alice Smith ',
      }),
    ).resolves.toEqual(updated);

    expect(userUpdate).toHaveBeenCalledWith({
      displayName: 'Alice Smith',
    });
  });

  it('updates avatar and mobile, including clearing them', async () => {
    const updated = { ...user, avatarUrl: null, mobile: null };
    userFirst.mockResolvedValueOnce(user);
    userUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateUser(user.id, { avatarUrl: null, mobile: null }),
    ).resolves.toEqual(updated);
    expect(userUpdate).toHaveBeenCalledWith({ avatarUrl: null, mobile: null });
  });

  it('deletes a user when it has no role assignments', async () => {
    userFirst.mockResolvedValueOnce(user);

    await expect(service.deleteUser(user.id)).resolves.toEqual({
      deleted: true,
    });
    expect(userDelete).toHaveBeenCalledTimes(1);
  });

  it('prevents deleting a user with assigned roles', async () => {
    userFirst.mockResolvedValueOnce(user);
    roleAssignmentFirst.mockResolvedValueOnce({ id: 'assignment-1' });

    await expect(service.deleteUser(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(userDelete).not.toHaveBeenCalled();
  });
});
