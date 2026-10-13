import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PermissionAction } from './permissions/types/permission.js';
import type { RoleData } from './roles/types/role.js';
import type { UnitData } from '../units/types/unit.js';

export interface AuthorizationPermission {
  resource: string;
  action: PermissionAction;
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  // Checks if a user has the necessary permission to perform an action on a resource, optionally within a specific organizational unit.
  async canAccess(
    userId: string,
    action: PermissionAction,
    resourceRoute: string,
    targetUnitId?: string | null,
  ): Promise<boolean> {
    // Step 1: validate the minimal request data before any DB lookup.
    if (!userId || !resourceRoute || !action) {
      return false;
    }

    const user = await this.prisma.public.User.where({ id: userId }).first();
    if (!user) {
      return false;
    }

    const globalAdmin = await this.prisma.public.GlobalAdmin.where({
      email: user.email,
    }).first();

    if (globalAdmin?.isActive) {
      return true;
    }

    const tenantId = user.tenantId;

    // Load assignments only from the user's tenant.
    const roleAssignments = await this.prisma.public.RoleAssignment.where({
      userId,
      tenantId,
    }).all();

    // Step 3: filter out inactive role assignments.
    const activeAssignments = roleAssignments.filter(
      (assignment) => assignment.isActive,
    );

    // Step 4: if the user has no active role assignments, they cannot access the resource.
    if (activeAssignments.length === 0) {
      return false;
    }

    // Step 5: load each active role once, check for the OWNER override, and keep valid roles for the normal permission evaluation.
    const activeRoles: RoleData[] = [];

    for (const assignment of activeAssignments) {
      const role = await this.prisma.public.Role.where({
        id: assignment.roleId,
        tenantId,
      }).first();

      // Skip any role that is not found or inactive.
      if (!role || !role.isActive) {
        continue;
      }

      // The immutable system key identifies the global owner role.
      if (role.systemKey === 'OWNER') {
        return true;
      }

      activeRoles.push(role);
    }

    // Step 6: resolve the route to the protected resource record.
    const resource = await this.prisma.public.Resource.where({
      tenantId,
      route: resourceRoute,
    }).first();

    // Step 7: if the resource does not exist, the check fails.
    if (!resource) {
      return false;
    }

    // Step 8: resolve the permission record for the resource and action.
    const permission = await this.prisma.public.Permission.where({
      tenantId,
      resourceId: resource.id,
      action,
    }).first();

    // Step 9: if the permission does not exist, the check fails.
    if (!permission) {
      return false;
    }

    // Step 10: build a map of all units for efficient ancestry checks during role validation.
    const unitsByIdMap = await this.getUnitsByIdMap(tenantId);

    // Step 11: iterate through the valid active roles to check for permission access.
    for (const role of activeRoles) {
      // Step 11a: check if the role is valid for the target unit based on its scope (SELF or DESCENDANTS).
      if (!this.isRoleValidForTargetUnit(role, targetUnitId, unitsByIdMap)) {
        continue;
      }

      // Step 11b: collect the effective permission IDs for the role, including any inherited from descendant roles.
      const effectivePermissionIds =
        await this.getEffectivePermissionIdsForRole(
          role,
          tenantId,
          unitsByIdMap,
        );

      // Step 11c: if the required permission ID is in the effective permission set, grant access.
      if (effectivePermissionIds.has(permission.id)) {
        return true;
      }
    }

    // Step 12: if no active role assignments grant the required permission, deny access.
    return false;
  }

  // Build a map for direct unit lookup while walking parent ancestry.
  private async getUnitsByIdMap(
    tenantId: string,
  ): Promise<Map<string, UnitData>> {
    const units = await this.prisma.public.Unit.where({ tenantId }).all();

    return new Map(units.map((unit) => [unit.id, unit] as const));
  }

  // Recursively collect the effective permission set for a role, considering its scope and descendants.
  private async getEffectivePermissionIdsForRole(
    role: RoleData,
    tenantId: string,
    unitsByIdMap: Map<string, UnitData>,
  ): Promise<Set<string>> {
    // Step 1: initialize a set to hold the unique permission IDs for this role.
    const permissionIds = new Set<string>();

    // Step 2: load the direct permissions assigned to this role and add them to the set.
    const directRolePermissions = await this.prisma.public.RolePermission.where(
      {
        tenantId,
        roleId: role.id,
      },
    ).all();

    for (const rolePermission of directRolePermissions) {
      // Add the permission ID to the set, ensuring uniqueness.
      permissionIds.add(rolePermission.permissionId);
    }

    // Step 3: if the role's scope is SELF, we do not need to consider descendant roles.
    if (role.scope !== 'DESCENDANTS') {
      return permissionIds;
    }

    // Step 4: load all roles in the system to evaluate descendant permissions.
    const allRoles = await this.prisma.public.Role.where({ tenantId }).all();

    for (const candidateRole of allRoles) {
      if (candidateRole.id === role.id || !candidateRole.isActive) {
        // Skip the current role itself and any inactive roles
        continue;
      }

      // Step 5: Check if the candidate role is a descendant of the current role's unit.
      if (
        candidateRole.unitId === role.unitId ||
        !this.isUnitInsideScope(role.unitId, candidateRole.unitId, unitsByIdMap)
      ) {
        // Skip this candidate role if it is not a descendant of the current role's unit.
        continue;
      }

      // Step 6: Load the permissions for the descendant role and add them to the set.
      const descendantPermissions =
        await this.prisma.public.RolePermission.where({
          tenantId,
          roleId: candidateRole.id,
        }).all();

      for (const descendantPermission of descendantPermissions) {
        permissionIds.add(descendantPermission.permissionId);
      }
    }

    // Step 7: return the complete set of effective permission IDs for this role, including its descendants.
    return permissionIds;
  }

  // Checks if a role is valid for a target unit based on its scope (SELF or DESCENDANTS).
  private isRoleValidForTargetUnit(
    role: RoleData,
    targetUnitId: string | null | undefined,
    unitsByIdMap: Map<string, UnitData>,
  ): boolean {
    // Step 1: a target unit is required before any scope rule can be checked.
    if (!targetUnitId) {
      return false;
    }

    // Step 2: SELF only applies when the role's unit matches the target unit.
    if (role.scope === 'SELF') {
      return role.unitId === targetUnitId;
    }

    // Step 3: DESCENDANTS applies when the target unit is inside the role's unit subtree.
    if (role.scope === 'DESCENDANTS') {
      return this.isUnitInsideScope(role.unitId, targetUnitId, unitsByIdMap);
    }

    return false;
  }

  // Checks if the target unit is inside the scope of the origin unit, considering the unit hierarchy.
  private isUnitInsideScope(
    originUnitId: string,
    targetUnitId: string,
    unitsByIdMap: Map<string, UnitData>,
  ): boolean {
    // Step 1: if the origin and target units are the same, the target is inside the scope.
    if (originUnitId === targetUnitId) {
      return true;
    }

    // Step 2: get the target unit from the map; if it doesn't exist, it's outside the scope.
    let current = unitsByIdMap.get(targetUnitId);

    // Step 3: walk the ancestry of the target unit upward to see if we reach the origin unit.
    while (current) {
      // Step 4: if we find the origin unit in the ancestry, the target is inside the scope.
      if (current.parentId === originUnitId) {
        return true;
      }

      // Step 5: move up the ancestry chain to the next parent unit.
      current = current.parentId
        ? unitsByIdMap.get(current.parentId)
        : undefined;
    }

    // Step 6: if we reach the root without finding the origin unit, the target is outside the scope.
    return false;
  }
}
