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
  async createRole(input: CreateRoleDto, tenantId?: string): Promise<RoleData> {
    const name = input.name.trim();

    if (name.toUpperCase() === 'OWNER') {
      throw new ConflictException('The OWNER role name is reserved');
    }

    const unit = await this.prisma.public.Unit.where({
      id: input.unitId,
      ...(tenantId ? { tenantId } : {}),
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
      tenantId: unit.tenantId,
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
  async listRoles(tenantId?: string): Promise<RoleData[]> {
    const query = tenantId
      ? this.prisma.public.Role.where({ tenantId })
      : this.prisma.public.Role;

    const roles = await query.all();
    return [...roles].sort((a, b) => a.name.localeCompare(b.name));
  }

  // READ ROLE BY ID
  async getRole(id: string, tenantId?: string): Promise<RoleData> {
    const role = await this.prisma.public.Role.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  // UPDATE ROLE
  async updateRole(
    id: string,
    input: UpdateRoleDto,
    tenantId?: string,
  ): Promise<RoleData> {
    const existing = await this.prisma.public.Role.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.systemKey !== null) {
      throw new ConflictException('System roles cannot be modified');
    }

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

    const unit = await this.prisma.public.Unit.where({
      id: nextUnitId,
      tenantId: existing.tenantId,
    }).first();

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (input.name !== undefined) {
      const duplicate = await this.prisma.public.Role.where({
        unitId: nextUnitId,
        name: nextName,
        tenantId: existing.tenantId,
      }).first();

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'A role with this name already exists in this unit',
        );
      }
    }

    const updated = await this.prisma.public.Role.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
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
  async deleteRole(id: string, tenantId?: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Role.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.systemKey !== null) {
      throw new ConflictException('System roles cannot be deleted');
    }

    const rolePermission = await this.prisma.public.RolePermission.where({
      roleId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (rolePermission) {
      throw new ConflictException(
        'Cannot delete a role while it is assigned permissions',
      );
    }

    const roleAssignment = await this.prisma.public.RoleAssignment.where({
      roleId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (roleAssignment) {
      throw new ConflictException(
        'Cannot delete a role while it is assigned to users',
      );
    }

    await this.prisma.public.Role.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }
}
