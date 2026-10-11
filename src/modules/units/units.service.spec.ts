import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { UnitsService } from './units.service.js';
import type { UnitData, UnitType } from './types/unit.js';
import { assertTargetParentIsValid, buildTree } from './utils/tree.js';

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

const unitFirst = jest.fn(async () => null as UnitData | null);
const unitUpdate = jest.fn(
  async (_data: {
    name?: string;
    type?: UnitType;
    description?: string | null;
    isActive?: boolean;
  }) => unit,
);
const unitDelete = jest.fn(async () => unit);
const unitCreate = jest.fn(
  async (data: {
    parentId: string | null;
    name: string;
    type: UnitType;
    description: string | null;
  }) => ({ ...unit, ...data }),
);
const unitAll = jest.fn(async () => [] as UnitData[]);
const unitWhere = jest.fn(() => ({
  first: unitFirst,
  update: unitUpdate,
  delete: unitDelete,
}));
const unitOrderBy = jest.fn(() => ({ all: unitAll }));
const roleFirst = jest.fn(async () => null as { id: string } | null);
const roleWhere = jest.fn(() => ({ first: roleFirst }));

const prisma = {
  public: {
    Unit: {
      where: unitWhere,
      create: unitCreate,
      orderBy: unitOrderBy,
    },
    Role: { where: roleWhere },
  },
};

describe('tree helpers', () => {
  it('builds a nested tree from flat unit rows', () => {
    const root: UnitData = {
      ...unit,
      id: 'root-1',
      parentId: null,
      name: 'Root',
    };
    const child: UnitData = {
      ...unit,
      id: 'child-1',
      parentId: 'root-1',
      name: 'Child',
    };
    const orphan: UnitData = {
      ...unit,
      id: 'orphan-1',
      parentId: 'missing-parent',
      name: 'Orphan',
    };

    const tree = buildTree([root, child, orphan]);

    expect(tree).toEqual([
      {
        ...root,
        children: [{ ...child, children: [] }],
      },
      { ...orphan, children: [] },
    ]);
  });

  it('returns an empty tree for empty or undefined input', () => {
    expect(buildTree([])).toEqual([]);
    expect(buildTree(undefined as unknown as UnitData[])).toEqual([]);
    expect(buildTree(null as unknown as UnitData[])).toEqual([]);
  });

  it('accepts a valid target parent while moving a unit', () => {
    const root: UnitData = {
      ...unit,
      id: 'root-1',
      parentId: null,
      name: 'Root',
    };
    const child: UnitData = {
      ...unit,
      id: 'child-1',
      parentId: root.id,
      name: 'Child',
    };

    expect(() =>
      assertTargetParentIsValid(child, root.id, [root, child]),
    ).not.toThrow();
  });

  it('validates both parent ancestry and duplicate sibling names in one check', () => {
    const root: UnitData = {
      ...unit,
      id: 'root-1',
      parentId: null,
      name: 'Root',
    };
    const child: UnitData = {
      ...unit,
      id: 'child-1',
      parentId: root.id,
      name: 'Child',
    };

    expect(() =>
      assertTargetParentIsValid(root, child.id, [root, child]),
    ).toThrow(ConflictException);

    expect(() =>
      assertTargetParentIsValid(child, 'target-parent', [
        root,
        {
          ...unit,
          id: 'duplicate-1',
          parentId: 'target-parent',
          name: 'Child',
        },
      ]),
    ).toThrow(ConflictException);
  });

  it('rejects moving a unit under itself or one of its descendants', () => {
    const root: UnitData = {
      ...unit,
      id: 'root-1',
      parentId: null,
      name: 'Root',
    };
    const child: UnitData = {
      ...unit,
      id: 'child-1',
      parentId: root.id,
      name: 'Child',
    };

    expect(() =>
      assertTargetParentIsValid(root, child.id, [root, child]),
    ).toThrow(ConflictException);
  });

  it('rejects moving a unit under an inactive ancestor', () => {
    const parent: UnitData = {
      ...unit,
      id: 'parent-1',
      parentId: null,
      name: 'Parent',
      isActive: false,
    };
    const child: UnitData = {
      ...unit,
      id: 'child-1',
      parentId: parent.id,
      name: 'Child',
    };

    expect(() =>
      assertTargetParentIsValid(child, parent.id, [parent, child]),
    ).toThrow(ForbiddenException);
  });

  it('rejects moving a unit when the target parent does not exist', () => {
    const current: UnitData = {
      ...unit,
      id: 'current-1',
      parentId: null,
      name: 'Team',
    };

    expect(() =>
      assertTargetParentIsValid(current, 'missing-parent', [current]),
    ).toThrow(NotFoundException);
  });

  it('rejects moving a unit into an ancestor cycle', () => {
    const rootA: UnitData = {
      ...unit,
      id: 'root-a',
      parentId: 'root-b',
      name: 'A',
    };
    const rootB: UnitData = {
      ...unit,
      id: 'root-b',
      parentId: 'root-a',
      name: 'B',
    };
    const current: UnitData = {
      ...unit,
      id: 'current-1',
      parentId: null,
      name: 'Current',
    };

    expect(() =>
      assertTargetParentIsValid(current, rootA.id, [rootA, rootB, current]),
    ).toThrow(ConflictException);
  });

  it('treats an undefined target as root and ignores missing sibling candidates', () => {
    const current: UnitData = {
      ...unit,
      id: 'current-1',
      parentId: null,
      name: 'Team',
    };

    expect(() =>
      assertTargetParentIsValid(current, undefined, [current]),
    ).not.toThrow();
  });

  it('rejects moving a unit into a parent that would create a duplicate sibling name', () => {
    const current: UnitData = {
      ...unit,
      id: 'current-1',
      parentId: null,
      name: 'Team',
    };
    const duplicate: UnitData = {
      ...unit,
      id: 'duplicate-1',
      parentId: 'target-parent',
      name: 'Team',
    };

    expect(() =>
      assertTargetParentIsValid(current, 'target-parent', [current, duplicate]),
    ).toThrow(ConflictException);
  });
});

describe('UnitsService', () => {
  let service: UnitsService;

  beforeEach(() => {
    unitFirst.mockReset().mockResolvedValue(null);
    unitUpdate.mockReset().mockResolvedValue(unit);
    unitDelete.mockReset().mockResolvedValue(unit);
    unitCreate.mockReset().mockImplementation(async (data) => ({
      ...unit,
      ...data,
    }));
    unitAll.mockReset().mockResolvedValue([]);
    unitWhere.mockClear();
    unitOrderBy.mockClear();
    roleFirst.mockReset().mockResolvedValue(null);
    roleWhere.mockClear();

    service = new UnitsService(prisma as unknown as PrismaService);
  });

  it('creates a root unit when parentId is omitted', async () => {
    await expect(
      service.createUnit({ name: ' Finance ', type: 'DEPARTMENT' }),
    ).resolves.toEqual(unit);
    expect(unitCreate).toHaveBeenCalledWith({
      parentId: null,
      name: 'Finance',
      type: 'DEPARTMENT',
      description: null,
    });
    expect(unitWhere).toHaveBeenCalledWith({ parentId: null, name: 'Finance' });
  });

  it('creates a child unit when its parent exists', async () => {
    unitFirst.mockResolvedValueOnce(unit);

    await service.createUnit({
      name: 'Accounts Payable',
      type: 'TEAM',
      parentId: unit.id,
    });

    expect(unitCreate).toHaveBeenCalledWith({
      parentId: unit.id,
      name: 'Accounts Payable',
      type: 'TEAM',
      description: null,
    });
  });

  it('rejects creating a unit with a missing parent', async () => {
    await expect(
      service.createUnit({
        name: 'Accounts Payable',
        type: 'TEAM',
        parentId: 'missing-parent',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(unitCreate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate sibling unit name', async () => {
    unitFirst.mockResolvedValueOnce(unit);

    await expect(
      service.createUnit({
        name: ' Finance ',
        type: 'DEPARTMENT',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(unitCreate).not.toHaveBeenCalled();
  });

  it('lists units ordered by name', async () => {
    unitAll.mockResolvedValueOnce([unit]);

    await expect(service.listUnits()).resolves.toEqual([unit]);
    expect(unitOrderBy).toHaveBeenCalledTimes(1);
  });

  it('gets a unit by id', async () => {
    unitFirst.mockResolvedValueOnce(unit);

    await expect(service.getUnit(unit.id)).resolves.toEqual(unit);
  });

  it('rejects getting a missing unit', async () => {
    await expect(service.getUnit('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates unit details without changing its parent', async () => {
    const updated = { ...unit, name: 'Finance Division', isActive: false };
    unitFirst.mockResolvedValueOnce(unit);
    unitUpdate.mockResolvedValueOnce(updated);

    await expect(
      service.updateUnit(unit.id, {
        name: ' Finance Division ',
        type: 'DEPARTMENT',
        description: null,
        isActive: false,
      }),
    ).resolves.toEqual(updated);

    expect(unitUpdate).toHaveBeenCalledWith({
      name: 'Finance Division',
      type: 'DEPARTMENT',
      description: null,
      isActive: false,
    });
  });

  it('rejects updating to a duplicate sibling name', async () => {
    unitFirst
      .mockResolvedValueOnce(unit)
      .mockResolvedValueOnce({ ...unit, id: 'unit-2' });

    await expect(
      service.updateUnit(unit.id, {
        name: 'Other Finance',
        type: 'DEPARTMENT',
        description: null,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(unitUpdate).not.toHaveBeenCalled();
  });

  it('deactivates an active unit by setting its status to false', async () => {
    const inactiveUnit = { ...unit, isActive: false };
    unitUpdate.mockResolvedValueOnce(inactiveUnit);

    await expect(service.updateUnitStatus(unit.id, false)).resolves.toEqual(
      inactiveUnit,
    );
    expect(unitWhere).toHaveBeenCalledWith({ id: unit.id });
    expect(unitUpdate).toHaveBeenCalledWith({ isActive: false });
  });

  it('activates an inactive unit by setting its status to true', async () => {
    const activeUnit = { ...unit, isActive: true };
    unitUpdate.mockResolvedValueOnce(activeUnit);

    await expect(service.updateUnitStatus(unit.id, true)).resolves.toEqual(
      activeUnit,
    );
    expect(unitUpdate).toHaveBeenCalledWith({ isActive: true });
  });

  it('succeeds when setting the current status again', async () => {
    const inactiveUnit = { ...unit, isActive: false };
    unitUpdate.mockResolvedValue(inactiveUnit);

    await expect(service.updateUnitStatus(unit.id, false)).resolves.toEqual(
      inactiveUnit,
    );
    await expect(service.updateUnitStatus(unit.id, false)).resolves.toEqual(
      inactiveUnit,
    );
    expect(unitUpdate).toHaveBeenNthCalledWith(1, { isActive: false });
    expect(unitUpdate).toHaveBeenNthCalledWith(2, { isActive: false });
  });

  it('rejects status updates for a missing unit', async () => {
    unitUpdate.mockResolvedValueOnce(null as never);

    await expect(
      service.updateUnitStatus('missing', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a leaf unit without roles', async () => {
    unitFirst.mockResolvedValueOnce(unit);

    await expect(service.deleteUnit(unit.id)).resolves.toEqual({
      deleted: true,
    });
    expect(unitDelete).toHaveBeenCalledTimes(1);
  });

  it('prevents deleting a unit that has child units', async () => {
    unitFirst.mockResolvedValueOnce(unit).mockResolvedValueOnce({
      ...unit,
      id: 'child-unit',
      parentId: unit.id,
    });

    await expect(service.deleteUnit(unit.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(unitDelete).not.toHaveBeenCalled();
  });

  it('prevents deleting a unit that has roles', async () => {
    unitFirst.mockResolvedValueOnce(unit);
    roleFirst.mockResolvedValueOnce({ id: 'role-1' });

    await expect(service.deleteUnit(unit.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(unitDelete).not.toHaveBeenCalled();
  });
});
