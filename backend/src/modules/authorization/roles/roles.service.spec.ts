import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { RolesService } from './roles.service.js';
import type { RoleData, RoleScope } from './types/role.js';
import type { UnitData } from '../../units/types/unit.js';

const unit: UnitData = {
  id: 'unit-1',
  parentId: null,
  name: 'Finance',
  type: 'DEPARTMENT',
  description: null,
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const role: RoleData = {
  id: 'role-1',
  unitId: unit.id,
  systemKey: null,
  name: 'Finance Manager',
  description: 'Approves payment workflows',
  scope: 'DESCENDANTS',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const unitFirst = jest.fn(async () => null as UnitData | null);
const unitWhere = jest.fn(() => ({ first: unitFirst }));
const roleFirst = jest.fn(async () => null as RoleData | null);
const roleUpdate = jest.fn(
  async (_data: {
    unitId: string;
    name: string;
    description: string | null;
    scope: RoleScope;
    isActive: boolean;
  }) => role,
);
const roleDelete = jest.fn(async () => role);
const roleCreate = jest.fn(
  async (data: {
    unitId: string;
    name: string;
    description: string | null;
    scope: RoleScope;
    isActive: boolean;
  }) => ({ ...role, ...data }),
);
const roleAll = jest.fn(async () => [] as RoleData[]);
const roleCount = jest.fn(async () => 0);
const roleQuery = {
  first: roleFirst,
  update: roleUpdate,
  delete: roleDelete,
  all: roleAll,
  count: roleCount,
  where: jest.fn(() => roleQuery),
  orderBy: jest.fn(() => roleQuery),
  limit: jest.fn(() => roleQuery),
  offset: jest.fn(() => roleQuery),
};
const roleWhere = jest.fn(() => roleQuery);
const rolePermissionFirst = jest.fn(async () => null as { id: string } | null);
const rolePermissionWhere = jest.fn(() => ({ first: rolePermissionFirst }));
const roleAssignmentFirst = jest.fn(async () => null as { id: string } | null);
const roleAssignmentWhere = jest.fn(() => ({ first: roleAssignmentFirst }));

const prisma = {
  public: {
    Unit: { where: unitWhere },
    Role: {
      where: roleWhere,
      create: roleCreate,
      all: roleAll,
    },
    RolePermission: { where: rolePermissionWhere },
    RoleAssignment: { where: roleAssignmentWhere },
  },
};

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(() => {
    unitFirst.mockReset().mockResolvedValue(null);
    unitWhere.mockClear();
    roleFirst.mockReset().mockResolvedValue(null);
    roleUpdate.mockReset().mockResolvedValue(role);
    roleDelete.mockReset().mockResolvedValue(role);
    roleCreate.mockReset().mockImplementation(async (data) => ({
      ...role,
      ...data,
    }));
    roleAll.mockReset().mockResolvedValue([]);
    roleCount.mockReset().mockResolvedValue(0);
    roleWhere.mockClear();
    rolePermissionFirst.mockReset().mockResolvedValue(null);
    rolePermissionWhere.mockClear();
    roleAssignmentFirst.mockReset().mockResolvedValue(null);
    roleAssignmentWhere.mockClear();

    service = new RolesService(prisma as unknown as PrismaService);
  });

  it('creates a role for an existing unit', async () => {
    unitFirst.mockResolvedValueOnce(unit);

    await expect(
      service.createRole({
        unitId: unit.id,
        name: '  Finance Manager  ',
        description: '  Approves payment workflows  ',
        scope: 'DESCENDANTS',
        isActive: true,
      }),
    ).resolves.toEqual({
      ...role,
      name: 'Finance Manager',
      description: 'Approves payment workflows',
      scope: 'DESCENDANTS',
      isActive: true,
    });

    expect(roleCreate).toHaveBeenCalledWith({
      unitId: unit.id,
      name: 'Finance Manager',
      description: 'Approves payment workflows',
      scope: 'DESCENDANTS',
      isActive: true,
    });
  });

  it('rejects creating a role for a missing unit', async () => {
    await expect(
      service.createRole({
        unitId: 'missing-unit',
        name: 'Finance Manager',
        description: null,
        scope: 'DESCENDANTS',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roleCreate).not.toHaveBeenCalled();
  });

  it('rejects creating a role with the reserved OWNER name', async () => {
    await expect(
      service.createRole({ unitId: unit.id, name: ' owner ' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(unitWhere).not.toHaveBeenCalled();
    expect(roleCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate role names in the same unit', async () => {
    unitFirst.mockResolvedValueOnce(unit);
    roleFirst.mockResolvedValueOnce(role);

    await expect(
      service.createRole({
        unitId: unit.id,
        name: 'Finance Manager',
        description: null,
        scope: 'SELF',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roleCreate).not.toHaveBeenCalled();
  });

  it('lists roles ordered by name', async () => {
    roleAll.mockResolvedValueOnce([role]);
    roleCount.mockResolvedValueOnce(1);

    await expect(service.listRoles()).resolves.toMatchObject({
      items: [role],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });
    expect(roleAll).toHaveBeenCalledTimes(1);
    expect(roleQuery.limit).toHaveBeenCalledWith(25);
  });

  it('gets a role by id', async () => {
    roleFirst.mockResolvedValueOnce(role);

    await expect(service.getRole(role.id)).resolves.toEqual(role);
  });

  it('rejects getting a missing role', async () => {
    await expect(service.getRole('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a role', async () => {
    const updated = {
      ...role,
      name: 'Senior Finance Manager',
      scope: 'SELF' as const,
    };

    unitFirst.mockResolvedValueOnce(unit);
    roleFirst.mockResolvedValueOnce(role).mockResolvedValueOnce(null);
    roleUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateRole(role.id, {
        unitId: unit.id,
        name: ' Senior Finance Manager ',
        description: null,
        scope: 'SELF',
        isActive: true,
      }),
    ).resolves.toEqual(updated);

    expect(roleUpdate).toHaveBeenCalledWith({
      unitId: unit.id,
      name: 'Senior Finance Manager',
      description: null,
      scope: 'SELF',
      isActive: true,
    });
  });

  it('keeps existing values when a partial update omits optional fields', async () => {
    const updated = {
      ...role,
      description: 'Updated role description',
    };

    unitFirst.mockResolvedValueOnce(unit);
    roleFirst.mockResolvedValueOnce(role).mockResolvedValueOnce(null);
    roleUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateRole(role.id, {
        description: ' Updated role description ',
      }),
    ).resolves.toEqual(updated);

    expect(roleUpdate).toHaveBeenCalledWith({
      unitId: role.unitId,
      name: role.name,
      description: 'Updated role description',
      scope: role.scope,
      isActive: role.isActive,
    });
  });

  it('rejects updating to a duplicate role name in the same unit', async () => {
    unitFirst.mockResolvedValueOnce(unit);
    roleFirst
      .mockResolvedValueOnce(role)
      .mockResolvedValueOnce({ ...role, id: 'role-2' });

    await expect(
      service.updateRole(role.id, {
        unitId: unit.id,
        name: 'Finance Manager',
        description: null,
        scope: 'SELF',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roleUpdate).not.toHaveBeenCalled();
  });

  it('prevents modifying a system role', async () => {
    roleFirst.mockResolvedValueOnce({ ...role, systemKey: 'OWNER' });

    await expect(
      service.updateRole(role.id, { name: 'Renamed Owner' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roleUpdate).not.toHaveBeenCalled();
  });

  it('deletes a role that has no permissions or assignments', async () => {
    roleFirst.mockResolvedValueOnce(role);

    await expect(service.deleteRole(role.id)).resolves.toEqual({
      deleted: true,
    });
    expect(roleDelete).toHaveBeenCalledTimes(1);
  });

  it('prevents deleting a role with permissions', async () => {
    roleFirst.mockResolvedValueOnce(role);
    rolePermissionFirst.mockResolvedValueOnce({ id: 'role-permission-1' });

    await expect(service.deleteRole(role.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(roleDelete).not.toHaveBeenCalled();
  });

  it('prevents deleting a system role', async () => {
    roleFirst.mockResolvedValueOnce({ ...role, systemKey: 'OWNER' });

    await expect(service.deleteRole(role.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(rolePermissionWhere).not.toHaveBeenCalled();
    expect(roleDelete).not.toHaveBeenCalled();
  });

  it('prevents deleting a role assigned to users', async () => {
    roleFirst.mockResolvedValueOnce(role);
    roleAssignmentFirst.mockResolvedValueOnce({ id: 'role-assignment-1' });

    await expect(service.deleteRole(role.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(roleDelete).not.toHaveBeenCalled();
  });
});
