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
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleAssignmentData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.roleAssignmentsService.createRoleAssignment(
      input,
      req.user.tenantId,
    );
  }

  @Get()
  @RequirePermission('/authorization/role-assignments', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listRoleAssignments(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<RoleAssignmentData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.roleAssignmentsService.listRoleAssignments(
      req.user.tenantId,
      query,
    );
  }

  @Get(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getRoleAssignment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleAssignmentData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.roleAssignmentsService.getRoleAssignment(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateRoleAssignment(
    @Param('id') id: string,
    @Body() input: UpdateRoleAssignmentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<RoleAssignmentData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.roleAssignmentsService.updateRoleAssignment(
      id,
      input,
      req.user.tenantId,
    );
  }

  @Delete(':id')
  @RequirePermission('/authorization/role-assignments/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteRoleAssignment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.roleAssignmentsService.deleteRoleAssignment(
      id,
      req.user.tenantId,
    );
  }
}
