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
  ): Promise<RoleAssignmentData> {
    // Check if the user exists
    const user = await this.prisma.public.User.where({
      id: input.userId,
    }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if the role exists
    const role = await this.prisma.public.Role.where({
      id: input.roleId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if the role assignment already exists
    const existing = await this.prisma.public.RoleAssignment.where({
      userId: input.userId,
      roleId: input.roleId,
    }).first();

    if (existing) {
      throw new ConflictException('This role is already assigned to the user');
    }

    // Create the role assignment
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
  async listRoleAssignments(): Promise<RoleAssignmentData[]> {
    const roleAssignments = await this.prisma.public.RoleAssignment.orderBy(
      (roleAssignment) => roleAssignment.createdAt.asc(),
    ).all();

    return roleAssignments.map((roleAssignment) => ({
      id: roleAssignment.id,
      userId: roleAssignment.userId,
      roleId: roleAssignment.roleId,
      isActive: roleAssignment.isActive,
      createdAt: roleAssignment.createdAt,
      updatedAt: roleAssignment.updatedAt,
    }));
  }

  // READ ROLE ASSIGNMENT BY ID
  async getRoleAssignment(id: string): Promise<RoleAssignmentData> {
    const roleAssignment = await this.prisma.public.RoleAssignment.where({
      id,
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
  ): Promise<RoleAssignmentData> {
    // Check if the role assignment exists
    const existing = await this.prisma.public.RoleAssignment.where({
      id,
    }).first();

    if (!existing) {
      throw new NotFoundException('Role assignment not found');
    }

    // Determine the next values for userId, roleId, and isActive
    const nextUserId = input.userId ?? existing.userId;
    const nextRoleId = input.roleId ?? existing.roleId;
    const nextIsActive = input.isActive ?? existing.isActive;

    // Check if the new user exists
    const user = await this.prisma.public.User.where({
      id: nextUserId,
    }).first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if the new role exists
    const role = await this.prisma.public.Role.where({
      id: nextRoleId,
    }).first();

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (input.userId !== undefined || input.roleId !== undefined) {
      // Check if the new role assignment already exists
      const duplicate = await this.prisma.public.RoleAssignment.where({
        userId: nextUserId,
        roleId: nextRoleId,
      }).first();

      // If a duplicate exists and it's not the same role assignment being updated, throw an exception
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'This role is already assigned to the user',
        );
      }
    }

    // Update the role assignment
    const updated = await this.prisma.public.RoleAssignment.where({
      id,
    }).update({
      userId: nextUserId,
      roleId: nextRoleId,
      isActive: nextIsActive,
    });

    // Check if the role assignment was updated
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
  async deleteRoleAssignment(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.RoleAssignment.where({
      id,
    }).first();

    if (!existing) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.prisma.public.RoleAssignment.where({ id }).delete();

    return { deleted: true };
  }
}
