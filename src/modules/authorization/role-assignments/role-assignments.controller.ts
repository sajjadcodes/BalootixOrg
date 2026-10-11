import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../guards/authorization.guard.js';
import { CreateRoleAssignmentDto } from './dto/create-role-assignment.dto.js';
import { UpdateRoleAssignmentDto } from './dto/update-role-assignment.dto.js';
import { RoleAssignmentsService } from './role-assignments.service.js';
import type { RoleAssignmentData } from './types/role-assignment.js';

@ApiTags('Role Assignments')
@Controller('authorization/role-assignments')
export class RoleAssignmentsController {
  constructor(
    private readonly roleAssignmentsService: RoleAssignmentsService,
  ) {}

  @Post()
  @RequirePermission('/authorization/role-assignments', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createRoleAssignment(
    @Body() input: CreateRoleAssignmentDto,
  ): Promise<RoleAssignmentData> {
    return this.roleAssignmentsService.createRoleAssignment(input);
  }

  @Get()
  @RequirePermission('/authorization/role-assignments', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRoleAssignments(): Promise<RoleAssignmentData[]> {
    return this.roleAssignmentsService.listRoleAssignments();
  }

  @Get(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRoleAssignment(@Param('id') id: string): Promise<RoleAssignmentData> {
    return this.roleAssignmentsService.getRoleAssignment(id);
  }

  @Patch(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRoleAssignment(
    @Param('id') id: string,
    @Body() input: UpdateRoleAssignmentDto,
  ): Promise<RoleAssignmentData> {
    return this.roleAssignmentsService.updateRoleAssignment(id, input);
  }

  @Delete(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRoleAssignment(@Param('id') id: string) {
    return this.roleAssignmentsService.deleteRoleAssignment(id);
  }
}
