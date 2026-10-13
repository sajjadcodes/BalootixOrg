import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../common/types/paginated-result.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';
import type { UserData } from './types/user.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../authorization/guards/authorization.guard.js';
import type { AuthenticatedRequest } from '../auth/types/auth.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('/users', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listUsers(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto,
  ): Promise<PaginatedResult<UserData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.usersService.listUsers(req.user.tenantId, query);
  }

  @Get(':id')
  @RequirePermission('/users/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUser(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.usersService.getUser(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/users/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.usersService.updateUser(id, input, req.user.tenantId);
  }

  @Delete(':id')
  @RequirePermission('/users/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.usersService.deleteUser(id, req.user.tenantId);
  }
}
