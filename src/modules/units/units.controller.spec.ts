import { jest } from '@jest/globals';
import type { UnitsService } from './units.service.js';
import { UnitsController } from './units.controller.js';
import type { UnitData } from './types/unit.js';

const unit: UnitData = {
  id: 'unit-1',
  parentId: null,
  name: 'Finance',
  type: 'DEPARTMENT',
  description: null,
  isActive: true,
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
};
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('UnitsController', () => {
  it('delegates unit creation', async () => {
    const createUnit = jest.fn(async () => unit);
    const controller = new UnitsController({
      createUnit,
    } as unknown as UnitsService);
    const input = { name: 'Finance', type: 'DEPARTMENT' as const };

    await expect(controller.createUnit(input, req)).resolves.toBe(unit);
    expect(createUnit).toHaveBeenCalledWith(input, 'tenant-1');
  });

  it('delegates unit listing', async () => {
    const listUnits = jest.fn(async () => [unit]);
    const controller = new UnitsController({
      listUnits,
    } as unknown as UnitsService);

    await expect(controller.listUnits(req)).resolves.toEqual([unit]);
  });

  it('delegates unit lookup', async () => {
    const getUnit = jest.fn(async () => unit);
    const controller = new UnitsController({
      getUnit,
    } as unknown as UnitsService);

    await expect(controller.getUnit(unit.id, req)).resolves.toBe(unit);
    expect(getUnit).toHaveBeenCalledWith(unit.id, 'tenant-1');
  });

  it('delegates unit tree retrieval', async () => {
    const tree = [{ ...unit, children: [] }];
    const getUnitsTree = jest.fn(async () => tree);
    const controller = new UnitsController({
      getUnitsTree,
    } as unknown as UnitsService);

    await expect(controller.getUnitsTree(req)).resolves.toEqual(tree);
    expect(getUnitsTree).toHaveBeenCalledTimes(1);
  });

  it('delegates unit updates', async () => {
    const updateUnit = jest.fn(async () => unit);
    const controller = new UnitsController({
      updateUnit,
    } as unknown as UnitsService);
    const input = {
      name: 'Finance',
      type: 'DEPARTMENT' as const,
      description: null,
      isActive: false,
    };

    await expect(controller.updateUnit(unit.id, input, req)).resolves.toBe(
      unit,
    );
    expect(updateUnit).toHaveBeenCalledWith(unit.id, input, 'tenant-1');
  });

  it('delegates unit status updates', async () => {
    const inactiveUnit = { ...unit, isActive: false };
    const updateUnitStatus = jest.fn(async () => inactiveUnit);
    const controller = new UnitsController({
      updateUnitStatus,
    } as unknown as UnitsService);

    await expect(
      controller.updateUnitStatus(unit.id, { isActive: false }, req),
    ).resolves.toBe(inactiveUnit);
    expect(updateUnitStatus).toHaveBeenCalledWith(unit.id, false, 'tenant-1');
  });

  it('delegates unit moves using targetUnitId', async () => {
    const moveUnit = jest.fn(async () => unit);
    const controller = new UnitsController({
      moveUnit,
    } as unknown as UnitsService);

    await expect(
      controller.moveUnit(unit.id, { targetUnitId: 'target-unit-1' }, req),
    ).resolves.toBe(unit);
    expect(moveUnit).toHaveBeenCalledWith(unit.id, 'target-unit-1', 'tenant-1');
  });

  it('delegates unit deletion', async () => {
    const deleteUnit = jest.fn(async () => ({ deleted: true as const }));
    const controller = new UnitsController({
      deleteUnit,
    } as unknown as UnitsService);

    await expect(controller.deleteUnit(unit.id, req)).resolves.toEqual({
      deleted: true,
    });
    expect(deleteUnit).toHaveBeenCalledWith(unit.id, 'tenant-1');
  });
});
