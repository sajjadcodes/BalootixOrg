import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthorizationGuard } from './guards/authorization.guard.js';
import { AuthorizationService } from './authorization.service.js';
import type { PermissionAction } from './permissions/types/permission.js';
import type { RoleData } from './roles/types/role.js';
import type { RoleAssignmentData } from './role-assignments/types/role-assignment.js';
import type { UserData } from '../users/types/user.js';

const resource = {
  id: 'resource-1',
  route: '/units/:id',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const permission = {
  id: 'permission-1',
  resourceId: 'resource-1',
  action: 'READ' as PermissionAction,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

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
const tenantId = 'tenant-1';
const tenantUser = { ...user, tenantId };

const roleSelf: RoleData = {
  id: 'role-self',
  unitId: 'unit-1',
  systemKey: null,
  name: 'Finance Reader',
  description: 'Reads finance data',
  scope: 'SELF',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const roleDescendants: RoleData = {
  id: 'role-desc',
  unitId: 'unit-1',
  systemKey: null,
  name: 'Finance Leader',
  description: 'Reads finance descendants',
  scope: 'DESCENDANTS',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const ownerRole: RoleData = {
  id: 'role-owner',
  unitId: 'unit-1',
  systemKey: 'OWNER',
  name: 'Organization Owner',
  description: 'App-wide owner override',
  scope: 'SELF',
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const roleAssignment: RoleAssignmentData = {
  id: 'ra-1',
  userId: user.id,
  roleId: roleSelf.id,
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const unitRoot = {
  id: 'unit-1',
  parentId: null,
  name: 'Finance',
  type: 'DEPARTMENT',
  description: null,
  isActive: true,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

const unitChild: any = {
  ...unitRoot,
  id: 'unit-2',
  parentId: 'unit-1',
  name: 'Payroll',
};

const unitOutside: any = {
  ...unitRoot,
  id: 'unit-3',
  parentId: null,
  name: 'HR',
};

const userFirst = jest.fn(async () => tenantUser);
const userWhere = jest.fn((_filter?: { id?: string }) => ({
  first: userFirst,
}));
const resourceWhere = jest.fn(async () => null as typeof resource | null);
const resourceFilter = jest.fn(
  (_filter?: { tenantId?: string; route?: string }) => ({
    first: resourceWhere,
  }),
);
const permissionWhere = jest.fn(async () => null as typeof permission | null);
const permissionFilter = jest.fn(
  (_filter?: { tenantId?: string; resourceId?: string; action?: string }) => ({
    first: permissionWhere,
  }),
);
const roleAssignmentAll = jest.fn(async () => [] as RoleAssignmentData[]);
const roleAssignmentFilter = jest.fn(
  (_filter?: { userId?: string; tenantId?: string }) => ({
    all: roleAssignmentAll,
  }),
);
const roleWhere = jest.fn(async () => null as RoleData | null);
const roleAll = jest.fn(async () => [] as RoleData[]);
const roleFilter = jest.fn((_filter?: { id?: string; tenantId?: string }) => ({
  first: roleWhere,
  all: roleAll,
}));
const rolePermissionAll = jest.fn(
  async (_args?: { roleId?: string; tenantId?: string }) =>
    [] as { id: string; roleId: string; permissionId: string }[],
);
const rolePermissionFilter = jest.fn(
  (args?: { roleId?: string; tenantId?: string }) => ({
    all: () => rolePermissionAll(args),
  }),
);
const unitAll = jest.fn(async () => [] as (typeof unitRoot)[]);
const unitFilter = jest.fn((_filter?: { tenantId?: string }) => ({
  all: unitAll,
}));

const prisma = {
  public: {
    User: { where: userWhere },
    Resource: { where: resourceFilter },
    Permission: { where: permissionFilter },
    RoleAssignment: { where: roleAssignmentFilter },
    Role: { where: roleFilter },
    RolePermission: { where: rolePermissionFilter },
    Unit: { where: unitFilter },
  },
};

describe('OrganizationAuthorizationService', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    userFirst.mockReset().mockResolvedValue(tenantUser);
    userWhere.mockClear();
    resourceWhere.mockReset().mockResolvedValue(null);
    resourceFilter.mockClear();
    permissionWhere.mockReset().mockResolvedValue(null);
    permissionFilter.mockClear();
    roleAssignmentAll.mockReset().mockResolvedValue([]);
    roleAssignmentFilter.mockClear();
    roleWhere.mockReset().mockResolvedValue(null);
    roleAll.mockReset().mockResolvedValue([]);
    roleFilter.mockClear();
    rolePermissionAll.mockReset().mockResolvedValue([]);
    rolePermissionFilter.mockClear();
    unitAll.mockReset().mockResolvedValue([]);
    unitFilter.mockClear();

    service = new AuthorizationService(prisma as unknown as PrismaService);
  });

  it('allows access when the user has an active OWNER role regardless of normal permissions', async () => {
    resourceWhere.mockResolvedValueOnce(null);
    permissionWhere.mockResolvedValueOnce(null);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(ownerRole)]);
    roleWhere.mockResolvedValueOnce(ownerRole);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(true);

    expect(roleAssignmentFilter).toHaveBeenCalledWith({
      userId: user.id,
      tenantId,
    });
    expect(roleFilter).toHaveBeenCalledWith({ id: ownerRole.id, tenantId });
  });

  it('does not grant the OWNER override to a role based only on its name', async () => {
    const roleNamedOwner = { ...ownerRole, systemKey: null };
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleNamedOwner)]);
    roleWhere.mockResolvedValueOnce(roleNamedOwner);
    resourceWhere.mockResolvedValueOnce(null);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('allows access when the user has the permission directly on the selected SELF role', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleSelf)]);
    roleWhere.mockResolvedValueOnce(roleSelf);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-1', roleId: roleSelf.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitChild]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(true);

    expect(resourceFilter).toHaveBeenCalledWith({
      tenantId,
      route: resource.route,
    });
    expect(permissionFilter).toHaveBeenCalledWith({
      tenantId,
      resourceId: resource.id,
      action: permission.action,
    });
    expect(unitFilter).toHaveBeenCalledWith({ tenantId });
  });

  it('denies SELF access when the permission belongs to another role in the same unit', async () => {
    const otherRole: RoleData = {
      ...roleSelf,
      id: 'role-other-same-unit',
      name: 'Other Finance Reader',
    };

    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleSelf)]);
    roleWhere.mockResolvedValueOnce(roleSelf);
    rolePermissionAll.mockImplementation(async (args?: { roleId?: string }) => {
      const roleId = args?.roleId;

      if (roleId === otherRole.id) {
        return [
          { id: 'rp-1', roleId: otherRole.id, permissionId: permission.id },
        ];
      }

      return [];
    });
    unitAll.mockResolvedValueOnce([unitRoot, unitChild]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('allows access for DESCENDANTS scope when the target unit is below the role unit', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleDescendants)]);
    roleWhere.mockResolvedValueOnce(roleDescendants);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-2', roleId: roleDescendants.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitChild]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-2'),
    ).resolves.toBe(true);
  });

  it('allows DESCENDANTS access when the permission belongs to a descendant role under the same parent unit', async () => {
    const descendantRole: RoleData = {
      ...roleSelf,
      id: 'role-descendant',
      unitId: 'unit-2',
      name: 'Payroll Reader',
      scope: 'SELF',
    };

    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleDescendants)]);
    roleWhere.mockResolvedValueOnce(roleDescendants);
    roleAll.mockResolvedValueOnce([roleDescendants, descendantRole]);
    rolePermissionAll
      .mockResolvedValueOnce([
        {
          id: 'rp-desc-1',
          roleId: roleDescendants.id,
          permissionId: 'other-permission',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rp-desc-2',
          roleId: descendantRole.id,
          permissionId: permission.id,
        },
      ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitChild]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-2'),
    ).resolves.toBe(true);
  });

  it('denies access for SELF scope when the target unit is a different branch', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleSelf)]);
    roleWhere.mockResolvedValueOnce(roleSelf);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-3', roleId: roleSelf.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitOutside]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-3'),
    ).resolves.toBe(false);
  });

  it('denies access for DESCENDANTS scope when the target unit is outside the subtree', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(roleDescendants)]);
    roleWhere.mockResolvedValueOnce(roleDescendants);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-4', roleId: roleDescendants.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitOutside]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-3'),
    ).resolves.toBe(false);
  });

  it('denies access when the required permission does not exist for the resource', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(null);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('denies access when the resource route is missing from the registry', async () => {
    resourceWhere.mockResolvedValueOnce(null);

    await expect(
      service.canAccess(user.id, permission.action, '/missing', 'unit-1'),
    ).resolves.toBe(false);
  });

  it('denies access when the role assignment is inactive', async () => {
    const inactiveAssignment = { ...assignmentFor(roleSelf), isActive: false };
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([inactiveAssignment]);
    roleWhere.mockResolvedValueOnce(roleSelf);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-5', roleId: roleSelf.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('denies access when the role itself is inactive', async () => {
    const inactiveRole = { ...roleSelf, isActive: false };
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(inactiveRole)]);
    roleWhere.mockResolvedValueOnce(inactiveRole);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-6', roleId: inactiveRole.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('denies access when the user has no assigned roles', async () => {
    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });

  it('allows access when any one active role grants the permission and the target matches scope', async () => {
    const secondRole: RoleData = {
      ...roleSelf,
      id: 'role-other',
      unitId: 'unit-3',
      name: 'HR Reader',
      scope: 'SELF',
    };

    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([
      assignmentFor(secondRole),
      assignmentFor(roleSelf),
    ]);
    roleWhere.mockResolvedValueOnce(secondRole).mockResolvedValueOnce(roleSelf);
    rolePermissionAll.mockImplementation(async (args?: { roleId?: string }) => {
      const roleId = args?.roleId;

      if (roleId === secondRole.id) {
        return [
          {
            id: 'rp-7',
            roleId: secondRole.id,
            permissionId: 'wrong-permission',
          },
        ];
      }

      if (roleId === roleSelf.id) {
        return [
          { id: 'rp-8', roleId: roleSelf.id, permissionId: permission.id },
        ];
      }

      return [];
    });
    unitAll.mockResolvedValueOnce([unitRoot, unitOutside]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(true);
  });

  it('denies access when no role in the user assignments can satisfy both permission and unit scope', async () => {
    const foreignRole: RoleData = {
      ...roleSelf,
      id: 'role-foreign',
      unitId: 'unit-3',
      name: 'HR Reader',
      scope: 'SELF',
    };

    resourceWhere.mockResolvedValueOnce(resource);
    permissionWhere.mockResolvedValueOnce(permission);
    roleAssignmentAll.mockResolvedValueOnce([assignmentFor(foreignRole)]);
    roleWhere.mockResolvedValueOnce(foreignRole);
    rolePermissionAll.mockResolvedValueOnce([
      { id: 'rp-9', roleId: foreignRole.id, permissionId: permission.id },
    ]);
    unitAll.mockResolvedValueOnce([unitRoot, unitOutside]);

    await expect(
      service.canAccess(user.id, permission.action, resource.route, 'unit-1'),
    ).resolves.toBe(false);
  });
});

describe('AuthorizationGuard', () => {
  it('allows the request when the route requirement is satisfied', async () => {
    const authz = {
      canAccess: jest.fn(async () => true),
    } as any;
    const guard = new AuthorizationGuard(new Reflector(), authz);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1' },
          params: { id: 'unit-1' },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws unauthorized when request has no authenticated user', async () => {
    const authz = {
      canAccess: jest.fn(),
    } as any;
    const guard = new AuthorizationGuard(new Reflector(), authz);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ params: { id: 'unit-1' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows unannotated handlers without requiring a permission', async () => {
    const authz = {
      canAccess: jest.fn(),
    } as any;
    const guard = new AuthorizationGuard(new Reflector(), authz);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1' },
          params: { id: 'unit-1' },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authz.canAccess).not.toHaveBeenCalled();
  });

  it('enforces the permission requirement when metadata exists', async () => {
    const authz = {
      canAccess: jest.fn(async () => false),
    } as any;
    const reflector = new Reflector();
    const guard = new AuthorizationGuard(reflector, authz);
    const handler = class TestHandler {};
    Reflect.defineMetadata(
      'authorization:permission',
      { resource: '/units/:id', action: 'READ' },
      handler,
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1' },
          params: { id: 'unit-1' },
        }),
      }),
      getHandler: () => handler,
      getClass: () => handler,
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(authz.canAccess).toHaveBeenCalledWith(
      'user-1',
      'READ',
      '/units/:id',
      'unit-1',
    );
  });
});

function assignmentFor(role: RoleData): RoleAssignmentData {
  return {
    id: `${role.id}-assignment`,
    userId: user.id,
    roleId: role.id,
    isActive: true,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  };
}
