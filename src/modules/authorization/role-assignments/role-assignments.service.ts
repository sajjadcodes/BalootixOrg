import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto.js';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto.js';
import type { RoleAssignmentData } from './types/role-assignment.js';

@Injectable()
export class RoleAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE ROLE ASSIGNMENT
  async createRoleAssignment(
    input: CreateRoleAssignmentDto,
    tenantId?: string,
  ): Promise<RoleAssignmentData> {
    const user = await this.prisma.public.User.where({
      id: input.userId,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.public.Role.where({
      id: input.roleId,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.prisma.public.RoleAssignment.where({
      userId: input.userId,
      roleId: input.roleId,
      tenantId: role.tenantId,
    }).first();

    if (existing) {
      throw new ConflictException('This role is already assigned to the user');
    }

    const created = await this.prisma.public.RoleAssignment.create({
      tenantId: role.tenantId,
      userId: input.userId,
      roleId: input.roleId,
      isActive: input.isActive ?? true,
    });

    return {
      id: created.id,
      userId: created.userId,
      roleId: created.roleId,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  // READ ROLE ASSIGNMENTS
  async listRoleAssignments(tenantId?: string): Promise<RoleAssignmentData[]> {
    const query = tenantId
      ? this.prisma.public.RoleAssignment.where({ tenantId })
      : this.prisma.public.RoleAssignment;

    const roleAssignments = await query.all();

    return [...roleAssignments]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((roleAssignment) => ({
        id: roleAssignment.id,
        userId: roleAssignment.userId,
        roleId: roleAssignment.roleId,
        isActive: roleAssignment.isActive,
        createdAt: roleAssignment.createdAt,
        updatedAt: roleAssignment.updatedAt,
      }));
  }

  // READ ROLE ASSIGNMENT BY ID
  async getRoleAssignment(
    id: string,
    tenantId?: string,
  ): Promise<RoleAssignmentData> {
    const roleAssignment = await this.prisma.public.RoleAssignment.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!roleAssignment) {
      throw new NotFoundException('Role assignment not found');
    }

    return {
      id: roleAssignment.id,
      userId: roleAssignment.userId,
      roleId: roleAssignment.roleId,
      isActive: roleAssignment.isActive,
      createdAt: roleAssignment.createdAt,
      updatedAt: roleAssignment.updatedAt,
    };
  }

  // UPDATE ROLE ASSIGNMENT
  async updateRoleAssignment(
    id: string,
    input: UpdateRoleAssignmentDto,
    tenantId?: string,
  ): Promise<RoleAssignmentData> {
    const existing = await this.prisma.public.RoleAssignment.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role assignment not found');
    }

    const nextUserId = input.userId ?? existing.userId;
    const nextRoleId = input.roleId ?? existing.roleId;
    const nextIsActive = input.isActive ?? existing.isActive;

    const user = await this.prisma.public.User.where({
      id: nextUserId,
      tenantId: existing.tenantId,
    }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.public.Role.where({
      id: nextRoleId,
      tenantId: existing.tenantId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (input.userId !== undefined || input.roleId !== undefined) {
      const duplicate = await this.prisma.public.RoleAssignment.where({
        userId: nextUserId,
        roleId: nextRoleId,
        tenantId: existing.tenantId,
      }).first();

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'This role is already assigned to the user',
        );
      }
    }

    const updated = await this.prisma.public.RoleAssignment.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      userId: nextUserId,
      roleId: nextRoleId,
      isActive: nextIsActive,
    });

    if (!updated) {
      throw new NotFoundException('Role assignment not found');
    }

    return {
      id: updated.id,
      userId: updated.userId,
      roleId: updated.roleId,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // DELETE ROLE ASSIGNMENT
  async deleteRoleAssignment(
    id: string,
    tenantId?: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.RoleAssignment.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.prisma.public.RoleAssignment.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }
}
