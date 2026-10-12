import { jest } from '@jest/globals';
import type { PermissionsService } from './permissions.service.js';
import { PermissionsController } from './permissions.controller.js';
import type { PermissionData } from './types/permission.js';

const permission: PermissionData = {
  id: 'permission-1',
  resourceId: 'resource-1',
  action: 'READ',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('PermissionsController', () => {
  it('delegates permission creation', async () => {
    const createPermission = jest.fn(async () => permission);
    const controller = new PermissionsController({
      createPermission,
    } as unknown as PermissionsService);

    await expect(
      controller.createPermission(
        {
          resourceId: permission.resourceId,
          action: 'READ',
        },
        req,
      ),
    ).resolves.toBe(permission);
    expect(createPermission).toHaveBeenCalledWith(
      {
        resourceId: permission.resourceId,
        action: 'READ',
      },
      'tenant-1',
    );
  });

  it('delegates permission listing', async () => {
    const listPermissions = jest.fn(async () => [permission]);
    const controller = new PermissionsController({
      listPermissions,
    } as unknown as PermissionsService);

    await expect(controller.listPermissions(req)).resolves.toEqual([
      permission,
    ]);
  });

  it('delegates permission lookup', async () => {
    const getPermission = jest.fn(async () => permission);
    const controller = new PermissionsController({
      getPermission,
    } as unknown as PermissionsService);

    await expect(controller.getPermission(permission.id, req)).resolves.toBe(
      permission,
    );
    expect(getPermission).toHaveBeenCalledWith(permission.id, 'tenant-1');
  });

  it('delegates permission updates', async () => {
    const updatePermission = jest.fn(async () => permission);
    const controller = new PermissionsController({
      updatePermission,
    } as unknown as PermissionsService);

    await expect(
      controller.updatePermission(
        permission.id,
        {
          resourceId: permission.resourceId,
          action: 'UPDATE',
        },
        req,
      ),
    ).resolves.toBe(permission);
    expect(updatePermission).toHaveBeenCalledWith(
      permission.id,
      {
        resourceId: permission.resourceId,
        action: 'UPDATE',
      },
      'tenant-1',
    );
  });

  it('delegates permission deletion', async () => {
    const deletePermission = jest.fn(async () => ({ deleted: true as const }));
    const controller = new PermissionsController({
      deletePermission,
    } as unknown as PermissionsService);

    await expect(
      controller.deletePermission(permission.id, req),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(deletePermission).toHaveBeenCalledWith(permission.id, 'tenant-1');
  });
});
