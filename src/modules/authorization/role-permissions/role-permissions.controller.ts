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
import { CreateRolePermissionDto } from './dto/create-role-permission.dto.js';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto.js';
import { RolePermissionsService } from './role-permissions.service.js';
import type { RolePermissionData } from './types/role-permission.js';

@ApiTags('Role Permissions')
@Controller('authorization/role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly rolePermissionsService: RolePermissionsService,
  ) {}

  @Post()
  @RequirePermission('/authorization/role-permissions', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createRolePermission(
    @Body() input: CreateRolePermissionDto,
  ): Promise<RolePermissionData> {
    return this.rolePermissionsService.createRolePermission(input);
  }

  @Get()
  @RequirePermission('/authorization/role-permissions', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRolePermissions(): Promise<RolePermissionData[]> {
    return this.rolePermissionsService.listRolePermissions();
  }

  @Get(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRolePermission(@Param('id') id: string): Promise<RolePermissionData> {
    return this.rolePermissionsService.getRolePermission(id);
  }

  @Patch(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRolePermission(
    @Param('id') id: string,
    @Body() input: UpdateRolePermissionDto,
  ): Promise<RolePermissionData> {
    return this.rolePermissionsService.updateRolePermission(id, input);
  }

  @Delete(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRolePermission(@Param('id') id: string) {
    return this.rolePermissionsService.deleteRolePermission(id);
  }
}
