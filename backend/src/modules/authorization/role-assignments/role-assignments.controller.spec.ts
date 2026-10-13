import { jest } from '@jest/globals';
import type { RoleAssignmentsService } from './role-assignments.service.js';
import { RoleAssignmentsController } from './role-assignments.controller.js';
import type { RoleAssignmentData } from './types/role-assignment.js';

const roleAssignment: RoleAssignmentData = {
  id: 'role-assignment-1',
  userId: 'user-1',
  roleId: 'role-1',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('RoleAssignmentsController', () => {
  it('delegates role assignment creation', async () => {
    const createRoleAssignment = jest.fn(async () => roleAssignment);
    const controller = new RoleAssignmentsController({
      createRoleAssignment,
    } as unknown as RoleAssignmentsService);

    await expect(
      controller.createRoleAssignment(
        {
          userId: roleAssignment.userId,
          roleId: roleAssignment.roleId,
          isActive: true,
        },
        req,
      ),
    ).resolves.toBe(roleAssignment);
    expect(createRoleAssignment).toHaveBeenCalledWith(
      {
        userId: roleAssignment.userId,
        roleId: roleAssignment.roleId,
        isActive: true,
      },
      'tenant-1',
    );
  });

  it('delegates role assignment listing', async () => {
    const listRoleAssignments = jest.fn(async () => [roleAssignment]);
    const controller = new RoleAssignmentsController({
      listRoleAssignments,
    } as unknown as RoleAssignmentsService);

    await expect(controller.listRoleAssignments(req)).resolves.toEqual([
      roleAssignment,
    ]);
  });

  it('delegates role assignment lookup', async () => {
    const getRoleAssignment = jest.fn(async () => roleAssignment);
    const controller = new RoleAssignmentsController({
      getRoleAssignment,
    } as unknown as RoleAssignmentsService);

    await expect(
      controller.getRoleAssignment(roleAssignment.id, req),
    ).resolves.toBe(roleAssignment);
    expect(getRoleAssignment).toHaveBeenCalledWith(
      roleAssignment.id,
      'tenant-1',
    );
  });

  it('delegates role assignment updates', async () => {
    const updateRoleAssignment = jest.fn(async () => roleAssignment);
    const controller = new RoleAssignmentsController({
      updateRoleAssignment,
    } as unknown as RoleAssignmentsService);

    await expect(
      controller.updateRoleAssignment(
        roleAssignment.id,
        {
          userId: 'user-2',
          roleId: roleAssignment.roleId,
          isActive: false,
        },
        req,
      ),
    ).resolves.toBe(roleAssignment);
    expect(updateRoleAssignment).toHaveBeenCalledWith(
      roleAssignment.id,
      {
        userId: 'user-2',
        roleId: roleAssignment.roleId,
        isActive: false,
      },
      'tenant-1',
    );
  });

  it('delegates role assignment deletion', async () => {
    const deleteRoleAssignment = jest.fn(async () => ({
      deleted: true as const,
    }));
    const controller = new RoleAssignmentsController({
      deleteRoleAssignment,
    } as unknown as RoleAssignmentsService);

    await expect(
      controller.deleteRoleAssignment(roleAssignment.id, req),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(deleteRoleAssignment).toHaveBeenCalledWith(
      roleAssignment.id,
      'tenant-1',
    );
  });
});
