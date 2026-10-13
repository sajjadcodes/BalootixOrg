import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ListQueryDto } from '../../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../../common/types/paginated-result.js';
import { paginateListQuery } from '../../../common/utils/list-query.js';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto.js';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto.js';
import type { RolePermissionData } from './types/role-permission.js';

@Injectable()
export class RolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE ROLE PERMISSION
  async createRolePermission(
    input: CreateRolePermissionDto,
    tenantId?: string,
  ): Promise<RolePermissionData> {
    const role = await this.prisma.public.Role.where({
      id: input.roleId,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permission = await this.prisma.public.Permission.where({
      id: input.permissionId,
      tenantId: role.tenantId,
    }).first();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const existing = await this.prisma.public.RolePermission.where({
      roleId: input.roleId,
      permissionId: input.permissionId,
      tenantId: role.tenantId,
    }).first();

    if (existing) {
      throw new ConflictException(
        'This permission is already assigned to the role',
      );
    }

    const created = await this.prisma.public.RolePermission.create({
      tenantId: role.tenantId,
      roleId: input.roleId,
      permissionId: input.permissionId,
    });

    return {
      id: created.id,
      roleId: created.roleId,
      permissionId: created.permissionId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  // READ ROLE PERMISSIONS
  async listRolePermissions(
    tenantId?: string,
    input: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<RolePermissionData>> {
    const result = await paginateListQuery<RolePermissionData>(
      this.prisma.public.RolePermission,
      input,
      {
        tenantId,
        defaultSortBy: 'createdAt',
        sortFields: {
          createdAt: 'createdAt',
          roleId: 'roleId',
          permissionId: 'permissionId',
        },
        filters: { roleId: 'roleId', permissionId: 'permissionId' },
      },
    );

    return {
      ...result,
      items: result.items.map((rolePermission) => ({
        id: rolePermission.id,
        roleId: rolePermission.roleId,
        permissionId: rolePermission.permissionId,
        createdAt: rolePermission.createdAt,
        updatedAt: rolePermission.updatedAt,
      })),
    };
  }

  // READ ROLE PERMISSION BY ID
  async getRolePermission(
    id: string,
    tenantId?: string,
  ): Promise<RolePermissionData> {
    const rolePermission = await this.prisma.public.RolePermission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!rolePermission) {
      throw new NotFoundException('Role permission not found');
    }

    return {
      id: rolePermission.id,
      roleId: rolePermission.roleId,
      permissionId: rolePermission.permissionId,
      createdAt: rolePermission.createdAt,
      updatedAt: rolePermission.updatedAt,
    };
  }

  // UPDATE ROLE PERMISSION
  async updateRolePermission(
    id: string,
    input: UpdateRolePermissionDto,
    tenantId?: string,
  ): Promise<RolePermissionData> {
    const existing = await this.prisma.public.RolePermission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role permission not found');
    }

    const role = await this.prisma.public.Role.where({
      id: input.roleId,
      tenantId: existing.tenantId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permission = await this.prisma.public.Permission.where({
      id: input.permissionId,
      tenantId: existing.tenantId,
    }).first();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    const duplicate = await this.prisma.public.RolePermission.where({
      roleId: input.roleId,
      permissionId: input.permissionId,
      tenantId: existing.tenantId,
    }).first();

    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'This permission is already assigned to the role',
      );
    }

    const updated = await this.prisma.public.RolePermission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      roleId: input.roleId,
      permissionId: input.permissionId,
    });

    if (!updated) {
      throw new NotFoundException('Role permission not found');
    }

    return {
      id: updated.id,
      roleId: updated.roleId,
      permissionId: updated.permissionId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // DELETE ROLE PERMISSION
  async deleteRolePermission(
    id: string,
    tenantId?: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.RolePermission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role permission not found');
    }

    await this.prisma.public.RolePermission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }
}
