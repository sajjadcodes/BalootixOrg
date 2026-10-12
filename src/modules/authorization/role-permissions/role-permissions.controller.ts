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
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../../common/types/paginated-result.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/types/auth.js';
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
    @Req() req: AuthenticatedRequest,
  ): Promise<RolePermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolePermissionsService.createRolePermission(
      input,
      req.user.tenantId,
    );
  }

  @Get()
  @RequirePermission('/authorization/role-permissions', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRolePermissions(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<RolePermissionData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolePermissionsService.listRolePermissions(
      req.user.tenantId,
      query,
    );
  }

  @Get(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRolePermission(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RolePermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolePermissionsService.getRolePermission(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRolePermission(
    @Param('id') id: string,
    @Body() input: UpdateRolePermissionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RolePermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolePermissionsService.updateRolePermission(
      id,
      input,
      req.user.tenantId,
    );
  }

  @Delete(':id')
  @RequirePermission('/authorization/role-permissions/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRolePermission(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolePermissionsService.deleteRolePermission(
      id,
      req.user.tenantId,
    );
  }
}
