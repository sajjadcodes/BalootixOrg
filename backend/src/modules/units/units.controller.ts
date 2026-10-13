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
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../common/types/paginated-result.js';
import { CreateUnitDto } from './dto/create-unit.dto.js';
import { MoveUnitDto } from './dto/move-unit.dto.js';
import { SetUnitStatusDto } from './dto/set-unit-status.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';
import { UnitsService } from './units.service.js';
import type { UnitData } from './types/unit.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../authorization/guards/authorization.guard.js';
import type { AuthenticatedRequest } from '../auth/types/auth.js';

@ApiTags('Units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @RequirePermission('/units', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createUnit(
    @Body() input: CreateUnitDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnitData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.createUnit(input, req.user.tenantId);
  }

  @Get()
  @RequirePermission('/units', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listUnits(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<UnitData>> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.listUnits(req.user.tenantId, query);
  }

  @Get('tree')
  @RequirePermission('/units/tree', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUnitsTree(@Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.getUnitsTree(req.user.tenantId);
  }

  @Get(':id')
  @RequirePermission('/units/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUnit(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnitData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.getUnit(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequirePermission('/units/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUnit(
    @Param('id') id: string,
    @Body() input: UpdateUnitDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnitData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.updateUnit(id, input, req.user.tenantId);
  }

  @Patch(':id/status')
  @RequirePermission('/units/:id/status', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUnitStatus(
    @Param('id') id: string,
    @Body() input: SetUnitStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnitData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.updateUnitStatus(
      id,
      input.isActive,
      req.user.tenantId,
    );
  }

  @Patch(':id/move')
  @RequirePermission('/units/:id/move', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  moveUnit(
    @Param('id') id: string,
    @Body() input: MoveUnitDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnitData> {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.moveUnit(
      id,
      input.targetUnitId ?? null,
      req.user.tenantId,
    );
  }

  @Delete(':id')
  @RequirePermission('/units/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteUnit(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req?.user?.tenantId) {
      throw new UnauthorizedException('Authentication context is required');
    }

    return this.unitsService.deleteUnit(id, req.user.tenantId);
  }
}
