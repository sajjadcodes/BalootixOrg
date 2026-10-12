import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUnitDto } from './dto/create-unit.dto.js';
import { UpdateUnitDto } from './dto/update-unit.dto.js';
import type { UnitData, UnitTreeNode } from './types/unit.js';
import { assertTargetParentIsValid, buildTree } from './utils/tree.js';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  //CREATE UNIT
  async createUnit(input: CreateUnitDto, tenantId?: string): Promise<UnitData> {
    const parentId = input.parentId ?? null;
    const name = input.name.trim();
    const description = input.description?.trim() || null;

    let effectiveTenantId: string | null = tenantId ?? null;

    if (parentId) {
      const parent = await this.prisma.public.Unit.where({
        id: parentId,
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      }).first();

      if (!parent) {
        throw new NotFoundException('Parent unit not found');
      }

      effectiveTenantId = parent.tenantId;
    } else if (!effectiveTenantId) {
      const defaultTenant = await this.prisma.public.Tenant.orderBy((tenant) =>
        tenant.createdAt.asc(),
      ).first();

      if (!defaultTenant) {
        throw new NotFoundException('No tenant is available for this unit');
      }

      effectiveTenantId = defaultTenant.id;
    }

    const duplicate = await this.prisma.public.Unit.where({
      parentId,
      name,
      tenantId: effectiveTenantId,
    }).first();

    if (duplicate) {
      throw new ConflictException(
        'A unit with this name already exists under this parent',
      );
    }

    return this.prisma.public.Unit.create({
      tenantId: effectiveTenantId,
      parentId,
      name,
      description,
      type: input.type,
    });
  }

  //READ UNITS
  async listUnits(tenantId?: string): Promise<UnitData[]> {
    const query = tenantId
      ? this.prisma.public.Unit.where({ tenantId })
      : this.prisma.public.Unit;

    const units = await query.all();
    return [...units].sort((a, b) => a.name.localeCompare(b.name));
  }

  //READ UNIT BY ID
  async getUnit(id: string, tenantId?: string): Promise<UnitData> {
    const unit = await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  //UPDATE UNIT
  async updateUnit(
    id: string,
    input: UpdateUnitDto,
    tenantId?: string,
  ): Promise<UnitData> {
    const existing = await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const name = input.name.trim();

    const duplicate = await this.prisma.public.Unit.where({
      parentId: existing.parentId,
      name,
      tenantId: existing.tenantId,
    }).first();

    if (duplicate && duplicate.id !== id) {
      throw new ConflictException(
        'A unit with this name already exists under this parent',
      );
    }

    const updated = await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      name,
      type: input.type,
      description: input.description?.trim() || null,
      isActive: input.isActive,
    });

    if (!updated) {
      throw new NotFoundException('Unit not found');
    }

    return updated;
  }

  //UPDATE UNIT STATUS
  async updateUnitStatus(
    id: string,
    isActive: boolean,
    tenantId?: string,
  ): Promise<UnitData> {
    const unit = await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      isActive,
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  //DELETE UNIT
  async deleteUnit(id: string, tenantId?: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Unit not found');
    }

    const child = await this.prisma.public.Unit.where({
      parentId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (child) {
      throw new ConflictException(
        'Cannot delete a unit while it has child units',
      );
    }

    const role = await this.prisma.public.Role.where({
      unitId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (role) {
      throw new ConflictException('Cannot delete a unit while it has roles');
    }

    await this.prisma.public.Unit.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }

  //MOVE UNIT
  async moveUnit(
    unitId: string,
    targetUnitId: string | null,
    tenantId?: string,
  ): Promise<UnitData> {
    return this.prisma.client.transaction(async (tx) => {
      const units = tenantId
        ? await tx.orm.public.Unit.where({ tenantId }).all()
        : await tx.orm.public.Unit.all();
      const unitsById = new Map(units.map((unit) => [unit.id, unit] as const));
      const unit = unitsById.get(unitId);

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      if (!unit.isActive) {
        throw new ForbiddenException('Cannot move an inactive unit');
      }

      assertTargetParentIsValid(unit, targetUnitId, units);

      const movedUnit = await tx.orm.public.Unit.where({
        id: unitId,
        ...(tenantId ? { tenantId } : {}),
      }).update({
        parentId: targetUnitId,
      });

      if (!movedUnit) {
        throw new NotFoundException('Unit not found');
      }

      return movedUnit;
    });
  }

  // GET UNITS TREE
  async getUnitsTree(tenantId?: string): Promise<UnitTreeNode[]> {
    const units = await this.listUnits(tenantId);
    return buildTree(units);
  }
}
