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
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import { ResourcesService } from './resources.service.js';
import type { ResourceData } from './types/resource.js';

@ApiTags('Resources')
@Controller('authorization/resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @RequirePermission('/authorization/resources', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createResource(
    @Body() input: CreateResourceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ResourceData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.resourcesService.createResource(input, req.user.tenantId);
  }

  @Get()
  @RequirePermission('/authorization/resources', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listResources(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<ResourceData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.resourcesService.listResources(req.user.tenantId, query);
  }

  @Get(':id')
  @RequirePermission('/authorization/resources/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getResource(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ResourceData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.resourcesService.getResource(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/authorization/resources/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateResource(
    @Param('id') id: string,
    @Body() input: UpdateResourceDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ResourceData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.resourcesService.updateResource(id, input, req.user.tenantId);
  }

  @Delete(':id')
  @RequirePermission('/authorization/resources/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteResource(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.resourcesService.deleteResource(id, req.user.tenantId);
  }
}
