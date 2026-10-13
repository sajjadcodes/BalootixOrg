import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { RoleAssignmentsService } from './role-assignments.service.js';
import type { RoleAssignmentData } from './types/role-assignment.js';
import type { RoleData } from '../roles/types/role.js';
import type { UserData } from '../../users/types/user.js';

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

const role: RoleData = {
  id: 'role-1',
  unitId: 'unit-1',
  systemKey: null,
  name: 'Finance Manager',
  description: 'Approves payment workflows',
  scope: 'DESCENDANTS',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const roleAssignment: RoleAssignmentData = {
  id: 'role-assignment-1',
  userId: user.id,
  roleId: role.id,
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const userFirst = jest.fn(async () => null as UserData | null);
const userWhere = jest.fn(() => ({ first: userFirst }));
const roleFirst = jest.fn(async () => null as RoleData | null);
const roleWhere = jest.fn(() => ({ first: roleFirst }));
const roleAssignmentFirst = jest.fn(
  async () => null as RoleAssignmentData | null,
);
const roleAssignmentUpdate = jest.fn(
  async (_data: { userId: string; roleId: string; isActive: boolean }) =>
    roleAssignment,
);
const roleAssignmentDelete = jest.fn(async () => roleAssignment);
const roleAssignmentCreate = jest.fn(
  async (data: { userId: string; roleId: string; isActive: boolean }) => ({
    ...roleAssignment,
    ...data,
  }),
);
const roleAssignmentAll = jest.fn(async () => [] as RoleAssignmentData[]);
const roleAssignmentCount = jest.fn(async () => 0);
const roleAssignmentQuery = {
  first: roleAssignmentFirst,
  update: roleAssignmentUpdate,
  delete: roleAssignmentDelete,
  all: roleAssignmentAll,
  count: roleAssignmentCount,
  where: jest.fn(() => roleAssignmentQuery),
  orderBy: jest.fn(() => roleAssignmentQuery),
  limit: jest.fn(() => roleAssignmentQuery),
  offset: jest.fn(() => roleAssignmentQuery),
};
const roleAssignmentWhere = jest.fn(() => roleAssignmentQuery);

const prisma = {
  public: {
    User: { where: userWhere },
    Role: { where: roleWhere },
    RoleAssignment: {
      where: roleAssignmentWhere,
      create: roleAssignmentCreate,
      all: roleAssignmentAll,
    },
  },
};

describe('RoleAssignmentsService', () => {
  let service: RoleAssignmentsService;

  beforeEach(() => {
    userFirst.mockReset().mockResolvedValue(null);
    userWhere.mockClear();
    roleFirst.mockReset().mockResolvedValue(null);
    roleWhere.mockClear();
    roleAssignmentFirst.mockReset().mockResolvedValue(null);
    roleAssignmentUpdate.mockReset().mockResolvedValue(roleAssignment);
    roleAssignmentDelete.mockReset().mockResolvedValue(roleAssignment);
    roleAssignmentCreate.mockReset().mockImplementation(async (data) => ({
      ...roleAssignment,
      ...data,
    }));
    roleAssignmentAll.mockReset().mockResolvedValue([]);
    roleAssignmentCount.mockReset().mockResolvedValue(0);
    roleAssignmentWhere.mockClear();

    service = new RoleAssignmentsService(prisma as unknown as PrismaService);
  });

  it('creates a role assignment for an existing user and role', async () => {
    userFirst.mockResolvedValueOnce(user);
    roleFirst.mockResolvedValueOnce(role);

    await expect(
      service.createRoleAssignment({
        userId: user.id,
        roleId: role.id,
        isActive: true,
      }),
    ).resolves.toEqual(roleAssignment);
    expect(roleAssignmentCreate).toHaveBeenCalledWith({
      userId: user.id,
      roleId: role.id,
      isActive: true,
    });
  });

  it('rejects creating a role assignment for a missing user', async () => {
    await expect(
      service.createRoleAssignment({
        userId: user.id,
        roleId: role.id,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roleAssignmentCreate).not.toHaveBeenCalled();
  });

  it('rejects creating a role assignment for a missing role', async () => {
    userFirst.mockResolvedValueOnce(user);

    await expect(
      service.createRoleAssignment({
        userId: user.id,
        roleId: role.id,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roleAssignmentCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicates for the same user and role pair', async () => {
    userFirst.mockResolvedValueOnce(user);
    roleFirst.mockResolvedValueOnce(role);
    roleAssignmentFirst.mockResolvedValueOnce(roleAssignment);

    await expect(
      service.createRoleAssignment({
        userId: user.id,
        roleId: role.id,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roleAssignmentCreate).not.toHaveBeenCalled();
  });

  it('lists role assignments ordered by createdAt', async () => {
    roleAssignmentAll.mockResolvedValueOnce([roleAssignment]);
    roleAssignmentCount.mockResolvedValueOnce(1);

    await expect(service.listRoleAssignments()).resolves.toMatchObject({
      items: [roleAssignment],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });
    expect(roleAssignmentAll).toHaveBeenCalledTimes(1);
    expect(roleAssignmentQuery.limit).toHaveBeenCalledWith(25);
  });

  it('gets a role assignment by id', async () => {
    roleAssignmentFirst.mockResolvedValueOnce(roleAssignment);

    await expect(service.getRoleAssignment(roleAssignment.id)).resolves.toEqual(
      roleAssignment,
    );
  });

  it('rejects getting a missing role assignment', async () => {
    await expect(service.getRoleAssignment('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a role assignment', async () => {
    const updated = {
      ...roleAssignment,
      userId: 'user-2',
      roleId: role.id,
      isActive: false,
    };
    roleAssignmentFirst
      .mockResolvedValueOnce(roleAssignment)
      .mockResolvedValueOnce(null);
    userFirst.mockResolvedValueOnce({ ...user, id: 'user-2' });
    roleFirst.mockResolvedValueOnce(role);
    roleAssignmentUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateRoleAssignment(roleAssignment.id, {
        userId: 'user-2',
        roleId: role.id,
        isActive: false,
      }),
    ).resolves.toEqual(updated);
    expect(roleAssignmentUpdate).toHaveBeenCalledWith({
      userId: 'user-2',
      roleId: role.id,
      isActive: false,
    });
  });

  it('rejects updating to a duplicate user/role assignment', async () => {
    roleAssignmentFirst
      .mockResolvedValueOnce(roleAssignment)
      .mockResolvedValueOnce({ ...roleAssignment, id: 'role-assignment-2' });
    userFirst.mockResolvedValueOnce(user);
    roleFirst.mockResolvedValueOnce(role);

    await expect(
      service.updateRoleAssignment(roleAssignment.id, {
        userId: user.id,
        roleId: role.id,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roleAssignmentUpdate).not.toHaveBeenCalled();
  });

  it('deletes a role assignment', async () => {
    roleAssignmentFirst.mockResolvedValueOnce(roleAssignment);

    await expect(
      service.deleteRoleAssignment(roleAssignment.id),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(roleAssignmentDelete).toHaveBeenCalledTimes(1);
  });
});
