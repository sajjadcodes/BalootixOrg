import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CreateRolePermissionDto } from './dto/create-role-permission.dto.js';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto.js';
import type { RolePermissionData } from './types/role-permission.js';

@Injectable()
export class RolePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE ROLE PERMISSION
  async createRolePermission(
    input: CreateRolePermissionDto,
  ): Promise<RolePermissionData> {
    // Check if the role exists
    const role = await this.prisma.public.Role.where({
      id: input.roleId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if the permission exists
    const permission = await this.prisma.public.Permission.where({
      id: input.permissionId,
    }).first();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if the role permission already exists
    const existing = await this.prisma.public.RolePermission.where({
      roleId: input.roleId,
      permissionId: input.permissionId,
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
  async listRolePermissions(): Promise<RolePermissionData[]> {
    const rolePermissions = await this.prisma.public.RolePermission.orderBy(
      (rolePermission) => rolePermission.createdAt.asc(),
    ).all();

    return rolePermissions.map((rolePermission) => ({
      id: rolePermission.id,
      roleId: rolePermission.roleId,
      permissionId: rolePermission.permissionId,
      createdAt: rolePermission.createdAt,
      updatedAt: rolePermission.updatedAt,
    }));
  }

  // READ ROLE PERMISSION BY ID
  async getRolePermission(id: string): Promise<RolePermissionData> {
    const rolePermission = await this.prisma.public.RolePermission.where({
      id,
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
  ): Promise<RolePermissionData> {
    // Check if the role permission exists
    const existing = await this.prisma.public.RolePermission.where({
      id,
    }).first();

    if (!existing) {
      throw new NotFoundException('Role permission not found');
    }

    // Check if the new role exists
    const role = await this.prisma.public.Role.where({
      id: input.roleId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if the new permission exists
    const permission = await this.prisma.public.Permission.where({
      id: input.permissionId,
    }).first();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if the new role-permission combination already exists
    const duplicate = await this.prisma.public.RolePermission.where({
      roleId: input.roleId,
      permissionId: input.permissionId,
    }).first();

    // If a duplicate exists and it's not the same role permission being updated, throw an exception
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'This permission is already assigned to the role',
      );
    }

    // Update the role permission
    const updated = await this.prisma.public.RolePermission.where({
      id,
    }).update({
      roleId: input.roleId,
      permissionId: input.permissionId,
    });

    // Check if the role permission was updated
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
  async deleteRolePermission(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.RolePermission.where({
      id,
    }).first();

    if (!existing) {
      throw new NotFoundException('Role permission not found');
    }

    await this.prisma.public.RolePermission.where({ id }).delete();

    return { deleted: true };
  }
}
