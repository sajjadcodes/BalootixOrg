import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import type { RoleData } from './types/role.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE ROLE
  async createRole(input: CreateRoleDto): Promise<RoleData> {
    const name = input.name.trim();

    if (name.toUpperCase() === 'OWNER') {
      throw new ConflictException('The OWNER role name is reserved');
    }

    const unit = await this.prisma.public.Unit.where({
      id: input.unitId,
    }).first();

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const description = input.description?.trim() || null;
    const scope = input.scope ?? 'DESCENDANTS';
    const isActive = input.isActive ?? true;

    const existing = await this.prisma.public.Role.where({
      unitId: input.unitId,
      name,
    }).first();

    if (existing) {
      throw new ConflictException(
        'A role with this name already exists in this unit',
      );
    }

    return this.prisma.public.Role.create({
      tenantId: unit.tenantId,
      unitId: input.unitId,
      name,
      description,
      scope,
      isActive,
    });
  }

  // READ ROLES
  async listRoles(): Promise<RoleData[]> {
    return await this.prisma.public.Role.orderBy((role) =>
      role.name.asc(),
    ).all();
  }

  // READ ROLE BY ID
  async getRole(id: string): Promise<RoleData> {
    const role = await this.prisma.public.Role.where({ id }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  // UPDATE ROLE
  async updateRole(id: string, input: UpdateRoleDto): Promise<RoleData> {
    const existing = await this.prisma.public.Role.where({ id }).first();

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.systemKey !== null) {
      throw new ConflictException('System roles cannot be modified');
    }

    // Determine the next values for the role, using existing values as defaults.
    const nextUnitId = input.unitId ?? existing.unitId;
    const nextName = input.name?.trim() ?? existing.name;

    if (nextName.toUpperCase() === 'OWNER') {
      throw new ConflictException('The OWNER role name is reserved');
    }

    const nextScope = input.scope ?? existing.scope;
    const nextIsActive = input.isActive ?? existing.isActive;
    const nextDescription =
      input?.description === undefined
        ? existing?.description
        : input?.description?.trim() || null;

    // Check if the new unit exists
    const unit = await this.prisma.public.Unit.where({
      id: nextUnitId,
    }).first();

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    // Check for duplicate role names in the new unit if the name or unitId is changing
    if (input.name !== undefined) {
      const duplicate = await this.prisma.public.Role.where({
        unitId: nextUnitId,
        name: nextName,
      }).first();

      // If a duplicate exists and it's not the same role being updated, throw an exception
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'A role with this name already exists in this unit',
        );
      }
    }

    const updated = await this.prisma.public.Role.where({ id }).update({
      unitId: nextUnitId,
      name: nextName,
      description: nextDescription,
      scope: nextScope,
      isActive: nextIsActive,
    });

    if (!updated) {
      throw new NotFoundException('Role not found');
    }

    return updated;
  }

  // DELETE ROLE
  async deleteRole(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Role.where({ id }).first();

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.systemKey !== null) {
      throw new ConflictException('System roles cannot be deleted');
    }

    // Check for permissions or assignments before deletion
    const rolePermission = await this.prisma.public.RolePermission.where({
      roleId: id,
    }).first();

    if (rolePermission) {
      throw new ConflictException(
        'Cannot delete a role while it is assigned permissions',
      );
    }

    // Check for role assignments before deletion
    const roleAssignment = await this.prisma.public.RoleAssignment.where({
      roleId: id,
    }).first();

    if (roleAssignment) {
      throw new ConflictException(
        'Cannot delete a role while it is assigned to users',
      );
    }

    await this.prisma.public.Role.where({ id }).delete();

    return { deleted: true };
  }
}
