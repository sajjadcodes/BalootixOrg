import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { RolePermissionsService } from './role-permissions.service.js';
import type { RolePermissionData } from './types/role-permission.js';
import type { RoleData } from '../roles/types/role.js';
import type { PermissionData } from '../permissions/types/permission.js';

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

const permission: PermissionData = {
  id: 'permission-1',
  resourceId: 'resource-1',
  action: 'READ',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const rolePermission: RolePermissionData = {
  id: 'role-permission-1',
  roleId: role.id,
  permissionId: permission.id,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const roleFirst = jest.fn(async () => null as RoleData | null);
const roleWhere = jest.fn(() => ({ first: roleFirst }));
const permissionFirst = jest.fn(async () => null as PermissionData | null);
const permissionWhere = jest.fn(() => ({ first: permissionFirst }));
const rolePermissionFirst = jest.fn(
  async () => null as RolePermissionData | null,
);
const rolePermissionUpdate = jest.fn(
  async (_data: { roleId: string; permissionId: string }) => rolePermission,
);
const rolePermissionDelete = jest.fn(async () => rolePermission);
const rolePermissionCreate = jest.fn(
  async (data: { roleId: string; permissionId: string }) => ({
    ...rolePermission,
    ...data,
  }),
);
const rolePermissionAll = jest.fn(async () => [] as RolePermissionData[]);
const rolePermissionWhere = jest.fn(() => ({
  first: rolePermissionFirst,
  update: rolePermissionUpdate,
  delete: rolePermissionDelete,
}));
const rolePermissionOrderBy = jest.fn(() => ({ all: rolePermissionAll }));

const prisma = {
  public: {
    Role: { where: roleWhere },
    Permission: { where: permissionWhere },
    RolePermission: {
      where: rolePermissionWhere,
      create: rolePermissionCreate,
      orderBy: rolePermissionOrderBy,
    },
  },
};

describe('RolePermissionsService', () => {
  let service: RolePermissionsService;

  beforeEach(() => {
    roleFirst.mockReset().mockResolvedValue(null);
    roleWhere.mockClear();
    permissionFirst.mockReset().mockResolvedValue(null);
    permissionWhere.mockClear();
    rolePermissionFirst.mockReset().mockResolvedValue(null);
    rolePermissionUpdate.mockReset().mockResolvedValue(rolePermission);
    rolePermissionDelete.mockReset().mockResolvedValue(rolePermission);
    rolePermissionCreate.mockReset().mockImplementation(async (data) => ({
      ...rolePermission,
      ...data,
    }));
    rolePermissionAll.mockReset().mockResolvedValue([]);
    rolePermissionWhere.mockClear();
    rolePermissionOrderBy.mockClear();

    service = new RolePermissionsService(prisma as unknown as PrismaService);
  });

  it('creates a role permission for an existing role and permission', async () => {
    roleFirst.mockResolvedValueOnce(role);
    permissionFirst.mockResolvedValueOnce(permission);

    await expect(
      service.createRolePermission({
        roleId: role.id,
        permissionId: permission.id,
      }),
    ).resolves.toEqual(rolePermission);
    expect(rolePermissionCreate).toHaveBeenCalledWith({
      roleId: role.id,
      permissionId: permission.id,
    });
  });

  it('rejects creating a role permission for a missing role', async () => {
    await expect(
      service.createRolePermission({
        roleId: role.id,
        permissionId: permission.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rolePermissionCreate).not.toHaveBeenCalled();
  });

  it('rejects creating a role permission for a missing permission', async () => {
    roleFirst.mockResolvedValueOnce(role);

    await expect(
      service.createRolePermission({
        roleId: role.id,
        permissionId: permission.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rolePermissionCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicates for the same role and permission pair', async () => {
    roleFirst.mockResolvedValueOnce(role);
    permissionFirst.mockResolvedValueOnce(permission);
    rolePermissionFirst.mockResolvedValueOnce(rolePermission);

    await expect(
      service.createRolePermission({
        roleId: role.id,
        permissionId: permission.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rolePermissionCreate).not.toHaveBeenCalled();
  });

  it('lists role permissions ordered by createdAt', async () => {
    rolePermissionAll.mockResolvedValueOnce([rolePermission]);

    await expect(service.listRolePermissions()).resolves.toEqual([
      rolePermission,
    ]);
    expect(rolePermissionOrderBy).toHaveBeenCalledTimes(1);
  });

  it('gets a role permission by id', async () => {
    rolePermissionFirst.mockResolvedValueOnce(rolePermission);

    await expect(service.getRolePermission(rolePermission.id)).resolves.toEqual(
      rolePermission,
    );
  });

  it('rejects getting a missing role permission', async () => {
    await expect(service.getRolePermission('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a role permission', async () => {
    const updated = {
      ...rolePermission,
      roleId: 'role-2',
      permissionId: permission.id,
    };
    rolePermissionFirst
      .mockResolvedValueOnce(rolePermission)
      .mockResolvedValueOnce(null);
    roleFirst.mockResolvedValueOnce(role);
    permissionFirst.mockResolvedValueOnce(permission);
    rolePermissionUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateRolePermission(rolePermission.id, {
        roleId: 'role-2',
        permissionId: permission.id,
      }),
    ).resolves.toEqual(updated);
    expect(rolePermissionUpdate).toHaveBeenCalledWith({
      roleId: 'role-2',
      permissionId: permission.id,
    });
  });

  it('rejects updating to a duplicate role/permission pair', async () => {
    rolePermissionFirst
      .mockResolvedValueOnce(rolePermission)
      .mockResolvedValueOnce({ ...rolePermission, id: 'role-permission-2' });
    roleFirst.mockResolvedValueOnce(role);
    permissionFirst.mockResolvedValueOnce(permission);

    await expect(
      service.updateRolePermission(rolePermission.id, {
        roleId: role.id,
        permissionId: permission.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rolePermissionUpdate).not.toHaveBeenCalled();
  });

  it('deletes a role permission', async () => {
    rolePermissionFirst.mockResolvedValueOnce(rolePermission);

    await expect(
      service.deleteRolePermission(rolePermission.id),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(rolePermissionDelete).toHaveBeenCalledTimes(1);
  });
});
