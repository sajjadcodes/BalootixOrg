import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { PermissionsService } from './permissions.service.js';
import type { PermissionAction, PermissionData } from './types/permission.js';
import type { ResourceData } from '../resources/types/resource.js';

const resource: ResourceData = {
  id: 'resource-1',
  route: '/users',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};
const permission: PermissionData = {
  id: 'permission-1',
  resourceId: resource.id,
  action: 'READ',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const resourceFirst = jest.fn(async () => null as ResourceData | null);
const resourceWhere = jest.fn(() => ({ first: resourceFirst }));
const permissionFirst = jest.fn(async () => null as PermissionData | null);
const permissionUpdate = jest.fn(
  async (_data: { resourceId: string; action: PermissionAction }) => permission,
);
const permissionDelete = jest.fn(async () => permission);
const permissionCreate = jest.fn(
  async (data: { resourceId: string; action: PermissionAction }) => ({
    ...permission,
    ...data,
  }),
);
const permissionAll = jest.fn(async () => [] as PermissionData[]);
const permissionCount = jest.fn(async () => 0);
const permissionQuery = {
  first: permissionFirst,
  update: permissionUpdate,
  delete: permissionDelete,
  all: permissionAll,
  count: permissionCount,
  where: jest.fn(() => permissionQuery),
  orderBy: jest.fn(() => permissionQuery),
  limit: jest.fn(() => permissionQuery),
  offset: jest.fn(() => permissionQuery),
};
const permissionWhere = jest.fn(() => permissionQuery);
const rolePermissionFirst = jest.fn(async () => null as { id: string } | null);
const rolePermissionWhere = jest.fn(() => ({ first: rolePermissionFirst }));

const prisma = {
  public: {
    Resource: { where: resourceWhere },
    Permission: {
      where: permissionWhere,
      create: permissionCreate,
      all: permissionAll,
    },
    RolePermission: { where: rolePermissionWhere },
  },
};

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    resourceFirst.mockReset().mockResolvedValue(null);
    resourceWhere.mockClear();
    permissionFirst.mockReset().mockResolvedValue(null);
    permissionUpdate.mockReset().mockResolvedValue(permission);
    permissionDelete.mockReset().mockResolvedValue(permission);
    permissionCreate.mockReset().mockImplementation(async (data) => ({
      ...permission,
      ...data,
    }));
    permissionAll.mockReset().mockResolvedValue([]);
    permissionCount.mockReset().mockResolvedValue(0);
    permissionWhere.mockClear();
    rolePermissionFirst.mockReset().mockResolvedValue(null);
    rolePermissionWhere.mockClear();

    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  it('creates a permission for an existing resource', async () => {
    resourceFirst.mockResolvedValueOnce(resource);

    await expect(
      service.createPermission({ resourceId: resource.id, action: 'READ' }),
    ).resolves.toEqual(permission);
    expect(permissionCreate).toHaveBeenCalledWith({
      resourceId: resource.id,
      action: 'READ',
    });
  });

  it('rejects creating a permission for a missing resource', async () => {
    await expect(
      service.createPermission({ resourceId: resource.id, action: 'READ' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(permissionCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate resource/action pair', async () => {
    resourceFirst.mockResolvedValueOnce(resource);
    permissionFirst.mockResolvedValueOnce(permission);

    await expect(
      service.createPermission({ resourceId: resource.id, action: 'READ' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(permissionCreate).not.toHaveBeenCalled();
  });

  it('lists permissions ordered by action', async () => {
    permissionAll.mockResolvedValueOnce([permission]);
    permissionCount.mockResolvedValueOnce(1);

    await expect(service.listPermissions()).resolves.toMatchObject({
      items: [permission],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });
    expect(permissionAll).toHaveBeenCalledTimes(1);
    expect(permissionQuery.limit).toHaveBeenCalledWith(25);
  });

  it('gets a permission by id', async () => {
    permissionFirst.mockResolvedValueOnce(permission);

    await expect(service.getPermission(permission.id)).resolves.toEqual(
      permission,
    );
  });

  it('rejects getting a missing permission', async () => {
    await expect(service.getPermission('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a permission', async () => {
    const updated = { ...permission, action: 'UPDATE' as const };
    permissionFirst
      .mockResolvedValueOnce(permission)
      .mockResolvedValueOnce(null);
    permissionUpdate.mockResolvedValueOnce(updated);
    resourceFirst.mockResolvedValueOnce(resource);

    await expect(
      service.updatePermission(permission.id, {
        resourceId: resource.id,
        action: 'UPDATE',
      }),
    ).resolves.toEqual(updated);
    expect(permissionUpdate).toHaveBeenCalledWith({
      resourceId: resource.id,
      action: 'UPDATE',
    });
  });

  it('preserves omitted fields during a partial update', async () => {
    const updated = { ...permission, action: 'UPDATE' as const };
    permissionFirst
      .mockResolvedValueOnce(permission)
      .mockResolvedValueOnce(null);
    resourceFirst.mockResolvedValueOnce(resource);
    permissionUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updatePermission(permission.id, { action: 'UPDATE' }),
    ).resolves.toEqual(updated);
    expect(permissionUpdate).toHaveBeenCalledWith({
      resourceId: permission.resourceId,
      action: 'UPDATE',
    });
  });

  it('rejects updating to a duplicate resource/action pair', async () => {
    permissionFirst
      .mockResolvedValueOnce(permission)
      .mockResolvedValueOnce({ ...permission, id: 'permission-2' });
    resourceFirst.mockResolvedValueOnce(resource);

    await expect(
      service.updatePermission(permission.id, {
        resourceId: resource.id,
        action: 'READ',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(permissionUpdate).not.toHaveBeenCalled();
  });

  it('deletes a permission that is not assigned to a role', async () => {
    permissionFirst.mockResolvedValueOnce(permission);

    await expect(service.deletePermission(permission.id)).resolves.toEqual({
      deleted: true,
    });
    expect(permissionDelete).toHaveBeenCalledTimes(1);
  });

  it('prevents deleting a permission assigned to a role', async () => {
    permissionFirst.mockResolvedValueOnce(permission);
    rolePermissionFirst.mockResolvedValueOnce({ id: 'role-permission-1' });

    await expect(
      service.deletePermission(permission.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(permissionDelete).not.toHaveBeenCalled();
  });
});
