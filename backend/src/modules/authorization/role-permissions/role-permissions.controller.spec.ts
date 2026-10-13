import { jest } from '@jest/globals';
import type { RolePermissionsService } from './role-permissions.service.js';
import { RolePermissionsController } from './role-permissions.controller.js';
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
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('RolePermissionsController', () => {
  it('delegates role permission creation', async () => {
    const createRolePermission = jest.fn(async () => rolePermission);
    const controller = new RolePermissionsController({
      createRolePermission,
    } as unknown as RolePermissionsService);

    await expect(
      controller.createRolePermission(
        {
          roleId: role.id,
          permissionId: permission.id,
        },
        req,
      ),
    ).resolves.toBe(rolePermission);
    expect(createRolePermission).toHaveBeenCalledWith(
      {
        roleId: role.id,
        permissionId: permission.id,
      },
      'tenant-1',
    );
  });

  it('delegates role permission listing', async () => {
    const listRolePermissions = jest.fn(async () => [rolePermission]);
    const controller = new RolePermissionsController({
      listRolePermissions,
    } as unknown as RolePermissionsService);

    await expect(controller.listRolePermissions(req)).resolves.toEqual([
      rolePermission,
    ]);
  });

  it('delegates role permission lookup', async () => {
    const getRolePermission = jest.fn(async () => rolePermission);
    const controller = new RolePermissionsController({
      getRolePermission,
    } as unknown as RolePermissionsService);

    await expect(
      controller.getRolePermission(rolePermission.id, req),
    ).resolves.toBe(rolePermission);
    expect(getRolePermission).toHaveBeenCalledWith(
      rolePermission.id,
      'tenant-1',
    );
  });

  it('delegates role permission updates', async () => {
    const updateRolePermission = jest.fn(async () => rolePermission);
    const controller = new RolePermissionsController({
      updateRolePermission,
    } as unknown as RolePermissionsService);

    await expect(
      controller.updateRolePermission(
        rolePermission.id,
        {
          roleId: 'role-2',
          permissionId: permission.id,
        },
        req,
      ),
    ).resolves.toBe(rolePermission);
    expect(updateRolePermission).toHaveBeenCalledWith(
      rolePermission.id,
      {
        roleId: 'role-2',
        permissionId: permission.id,
      },
      'tenant-1',
    );
  });

  it('delegates role permission deletion', async () => {
    const deleteRolePermission = jest.fn(async () => ({
      deleted: true as const,
    }));
    const controller = new RolePermissionsController({
      deleteRolePermission,
    } as unknown as RolePermissionsService);

    await expect(
      controller.deleteRolePermission(rolePermission.id, req),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(deleteRolePermission).toHaveBeenCalledWith(
      rolePermission.id,
      'tenant-1',
    );
  });
});
