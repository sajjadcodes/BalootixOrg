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
    @Req() req: AuthenticatedRequest,
  ): Promise<PermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.permissionsService.createPermission(input, req.user.tenantId);
  }

  @Get()
  @RequirePermission('/authorization/permissions', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listPermissions(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<PermissionData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.permissionsService.listPermissions(req.user.tenantId, query);
  }

  @Get(':id')
  @RequirePermission('/authorization/permissions/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getPermission(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.permissionsService.getPermission(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/authorization/permissions/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updatePermission(
    @Param('id') id: string,
    @Body() input: UpdatePermissionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PermissionData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.permissionsService.updatePermission(
      id,
      input,
      req.user.tenantId,
    );
  }

  @Delete(':id')
  @RequirePermission('/authorization/permissions/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deletePermission(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.permissionsService.deletePermission(id, req.user.tenantId);
  }
}
