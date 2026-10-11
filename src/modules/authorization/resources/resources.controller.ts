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
  createResource(@Body() input: CreateResourceDto): Promise<ResourceData> {
    return this.resourcesService.createResource(input);
  }

  @Get()
  @RequirePermission('/authorization/resources', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listResources(): Promise<ResourceData[]> {
    return this.resourcesService.listResources();
  }

  @Get(':id')
  @RequirePermission('/authorization/resources/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getResource(@Param('id') id: string): Promise<ResourceData> {
    return this.resourcesService.getResource(id);
  }

  @Patch(':id')
  @RequirePermission('/authorization/resources/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateResource(
    @Param('id') id: string,
    @Body() input: UpdateResourceDto,
  ): Promise<ResourceData> {
    return this.resourcesService.updateResource(id, input);
  }

  @Delete(':id')
  @RequirePermission('/authorization/resources/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteResource(@Param('id') id: string) {
    return this.resourcesService.deleteResource(id);
  }
}
