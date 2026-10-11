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
  createRole(@Body() input: CreateRoleDto): Promise<RoleData> {
    return this.rolesService.createRole(input);
  }

  @Get()
  @RequirePermission('/authorization/roles', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRoles(): Promise<RoleData[]> {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  @RequirePermission('/authorization/roles/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRole(@Param('id') id: string): Promise<RoleData> {
    return this.rolesService.getRole(id);
  }

  @Patch(':id')
  @RequirePermission('/authorization/roles/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRole(
    @Param('id') id: string,
    @Body() input: UpdateRoleDto,
  ): Promise<RoleData> {
    return this.rolesService.updateRole(id, input);
  }

  @Delete(':id')
  @RequirePermission('/authorization/roles/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
