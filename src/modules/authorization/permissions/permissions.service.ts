import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';
import type { PermissionData } from './types/permission.js';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  //CREATE PERMISSION
  async createPermission(
    input: CreatePermissionDto,
    tenantId?: string,
  ): Promise<PermissionData> {
    const resource = await this.prisma.public.Resource.where({
      id: input.resourceId,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    const existing = await this.prisma.public.Permission.where({
      resourceId: input.resourceId,
      action: input.action,
      tenantId: resource.tenantId,
    }).first();

    if (existing) {
      throw new ConflictException(
        'This action is already assigned to the resource',
      );
    }

    return this.prisma.public.Permission.create({
      tenantId: resource.tenantId,
      resourceId: input.resourceId,
      action: input.action,
    });
  }

  //READ PERMISSIONS
  async listPermissions(tenantId?: string): Promise<PermissionData[]> {
    const query = tenantId
      ? this.prisma.public.Permission.where({ tenantId })
      : this.prisma.public.Permission;

    const permissions = await query.all();
    return [...permissions].sort((a, b) => a.action.localeCompare(b.action));
  }

  //READ PERMISSION BY ID
  async getPermission(id: string, tenantId?: string): Promise<PermissionData> {
    const permission = await this.prisma.public.Permission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  //UPDATE PERMISSION
  async updatePermission(
    id: string,
    input: UpdatePermissionDto,
    tenantId?: string,
  ): Promise<PermissionData> {
    const existing = await this.prisma.public.Permission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    const nextResourceId = input.resourceId ?? existing.resourceId;
    const nextAction = input.action ?? existing.action;

    const resource = await this.prisma.public.Resource.where({
      id: nextResourceId,
      tenantId: existing.tenantId,
    }).first();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    const duplicate = await this.prisma.public.Permission.where({
      resourceId: nextResourceId,
      action: nextAction,
      tenantId: existing.tenantId,
    }).first();

    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'This action is already assigned to the resource',
      );
    }

    const updated = await this.prisma.public.Permission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      resourceId: nextResourceId,
      action: nextAction,
    });

    if (!updated) {
      throw new NotFoundException('Permission not found');
    }

    return updated;
  }

  //DELETE PERMISSION
  async deletePermission(
    id: string,
    tenantId?: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Permission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    const rolePermission = await this.prisma.public.RolePermission.where({
      permissionId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (rolePermission) {
      throw new ConflictException(
        'Cannot delete a permission while it is assigned to roles',
      );
    }

    await this.prisma.public.Permission.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }
}
