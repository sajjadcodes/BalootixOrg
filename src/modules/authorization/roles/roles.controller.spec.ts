import { jest } from '@jest/globals';
import type { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';
import type { RoleData } from './types/role.js';

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

describe('RolesController', () => {
  it('delegates role creation', async () => {
    const createRole = jest.fn(async () => role);
    const controller = new RolesController({
      createRole,
    } as unknown as RolesService);

    await expect(
      controller.createRole({
        unitId: role.unitId,
        name: role.name,
        description: role.description,
        scope: 'DESCENDANTS',
        isActive: true,
      }),
    ).resolves.toBe(role);
    expect(createRole).toHaveBeenCalledWith({
      unitId: role.unitId,
      name: role.name,
      description: role.description,
      scope: 'DESCENDANTS',
      isActive: true,
    });
  });

  it('delegates role listing', async () => {
    const listRoles = jest.fn(async () => [role]);
    const controller = new RolesController({
      listRoles,
    } as unknown as RolesService);

    await expect(controller.listRoles()).resolves.toEqual([role]);
  });

  it('delegates role lookup', async () => {
    const getRole = jest.fn(async () => role);
    const controller = new RolesController({
      getRole,
    } as unknown as RolesService);

    await expect(controller.getRole(role.id)).resolves.toBe(role);
    expect(getRole).toHaveBeenCalledWith(role.id);
  });

  it('delegates role updates', async () => {
    const updateRole = jest.fn(async () => role);
    const controller = new RolesController({
      updateRole,
    } as unknown as RolesService);

    await expect(
      controller.updateRole(role.id, {
        unitId: role.unitId,
        name: 'Senior Finance Manager',
        description: role.description,
        scope: 'SELF',
        isActive: true,
      }),
    ).resolves.toBe(role);
    expect(updateRole).toHaveBeenCalledWith(role.id, {
      unitId: role.unitId,
      name: 'Senior Finance Manager',
      description: role.description,
      scope: 'SELF',
      isActive: true,
    });
  });

  it('delegates role deletion', async () => {
    const deleteRole = jest.fn(async () => ({ deleted: true as const }));
    const controller = new RolesController({
      deleteRole,
    } as unknown as RolesService);

    await expect(controller.deleteRole(role.id)).resolves.toEqual({
      deleted: true,
    });
    expect(deleteRole).toHaveBeenCalledWith(role.id);
  });
});
