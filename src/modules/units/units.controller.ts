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
import { CreateUnitDto } from './dto/create-unit.dto.js';
import { MoveUnitDto } from './dto/move-unit.dto.js';
import { SetUnitStatusDto } from './dto/set-unit-status.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';
import { UnitsService } from './units.service.js';
import type { UnitData } from './types/unit.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../authorization/guards/authorization.guard.js';

@ApiTags('Units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @RequirePermission('/units', 'CREATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  createUnit(@Body() input: CreateUnitDto): Promise<UnitData> {
    return this.unitsService.createUnit(input);
  }

  @Get()
  @RequirePermission('/units', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listUnits(): Promise<UnitData[]> {
    return this.unitsService.listUnits();
  }

  @Get('tree')
  @RequirePermission('/units/tree', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUnitsTree() {
    return this.unitsService.getUnitsTree();
  }

  @Get(':id')
  @RequirePermission('/units/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUnit(@Param('id') id: string): Promise<UnitData> {
    return this.unitsService.getUnit(id);
  }

  @Patch(':id')
  @RequirePermission('/units/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUnit(
    @Param('id') id: string,
    @Body() input: UpdateUnitDto,
  ): Promise<UnitData> {
    return this.unitsService.updateUnit(id, input);
  }

  @Patch(':id/status')
  @RequirePermission('/units/:id/status', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUnitStatus(
    @Param('id') id: string,
    @Body() input: SetUnitStatusDto,
  ): Promise<UnitData> {
    return this.unitsService.updateUnitStatus(id, input.isActive);
  }

  @Patch(':id/move')
  @RequirePermission('/units/:id/move', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  moveUnit(
    @Param('id') id: string,
    @Body() input: MoveUnitDto,
  ): Promise<UnitData> {
    return this.unitsService.moveUnit(id, input.targetUnitId ?? null);
  }

  @Delete(':id')
  @RequirePermission('/units/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteUnit(@Param('id') id: string) {
    return this.unitsService.deleteUnit(id);
  }
}
