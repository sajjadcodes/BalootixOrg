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
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';
import { PermissionsService } from './permissions.service.js';
import type { PermissionData } from './types/permission.js';

@ApiTags('Permissions')
@Controller('authorization/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @RequirePermission('/authorization/permissions', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createPermission(
    @Body() input: CreatePermissionDto,
  ): Promise<PermissionData> {
    return this.permissionsService.createPermission(input);
  }

  @Get()
  @RequirePermission('/authorization/permissions', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listPermissions(): Promise<PermissionData[]> {
    return this.permissionsService.listPermissions();
  }

  @Get(':id')
  @RequirePermission('/authorization/permissions/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getPermission(@Param('id') id: string): Promise<PermissionData> {
    return this.permissionsService.getPermission(id);
  }

  @Patch(':id')
  @RequirePermission('/authorization/permissions/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updatePermission(
    @Param('id') id: string,
    @Body() input: UpdatePermissionDto,
  ): Promise<PermissionData> {
    return this.permissionsService.updatePermission(id, input);
  }

  @Delete(':id')
  @RequirePermission('/authorization/permissions/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deletePermission(@Param('id') id: string) {
    return this.permissionsService.deletePermission(id);
  }
}
