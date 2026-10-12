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
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/types/auth.js';
import { RequirePermission } from '../decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../guards/authorization.guard.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RolesService } from './roles.service.js';
import type { RoleData } from './types/role.js';

@ApiTags('Roles')
@Controller('authorization/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermission('/authorization/roles', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createRole(
    @Body() input: CreateRoleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolesService.createRole(input, req.user.tenantId);
  }

  @Get()
  @RequirePermission('/authorization/roles', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRoles(@Req() req: AuthenticatedRequest): Promise<RoleData[]> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolesService.listRoles(req.user.tenantId);
  }

  @Get(':id')
  @RequirePermission('/authorization/roles/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRole(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolesService.getRole(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/authorization/roles/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRole(
    @Param('id') id: string,
    @Body() input: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolesService.updateRole(id, input, req.user.tenantId);
  }

  @Delete(':id')
  @RequirePermission('/authorization/roles/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRole(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.rolesService.deleteRole(id, req.user.tenantId);
  }
}
