import { ConflictException, NotFoundException } from '@nestjs/common';
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
const userWhere = jest.fn(() => ({
  first: userFirst,
  update: userUpdate,
  delete: userDelete,
  all: userAll,
}));
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
    userWhere.mockClear();
    roleAssignmentFirst.mockReset().mockResolvedValue(null);
    roleAssignmentWhere.mockClear();

    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('lists users ordered by display name within the current tenant', async () => {
    userAll.mockResolvedValueOnce([user]);

    await expect(service.listUsers('tenant-a')).resolves.toEqual([user]);
    expect(userWhere).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(userAll).toHaveBeenCalledTimes(1);
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
