import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UnitData, UnitTreeNode } from '../types/unit';

// Normalizes the unit list by filtering out invalid entries.
function normalizeUnits(units?: UnitData[] | null): UnitData[] {
  if (!Array.isArray(units)) {
    return [];
  }

  // Filter out any null or undefined units and ensure each unit has a valid ID.
  return units.filter(
    (unit): unit is UnitData => !!unit && typeof unit.id === 'string',
  );
}

// Converts the flat unit list into a nested tree.
export function buildTree(units?: UnitData[] | null): UnitTreeNode[] {
  const roots: UnitTreeNode[] = [];

  // Normalize the units to ensure we have a valid array.
  const safeUnits = normalizeUnits(units);

  // Create a node for every unit so parents can be found by ID.
  const nodes = new Map<string, UnitTreeNode>(
    safeUnits.map((unit) => [unit.id, { ...unit, children: [] }]),
  );

  for (const node of nodes.values()) {
    // If the unit has no parent, it's a root node.
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    // If the unit has a parent, find it.
    const parent = nodes.get(node.parentId);

    if (parent) {
      // If the parent exists, add this unit to its children.
      parent.children.push(node);
    } else {
      // Keep the unit visible if its parent isn't in the supplied list.
      roots.push(node);
    }
  }

  return roots;
}

// Assert that the target parent is valid for moving a unit and that the
// resulting sibling names remain unique under that target.
export function assertTargetParentIsValid(
  unit: UnitData,
  targetUnitId?: string | null,
  units?: UnitData[] | null,
): void {
  // Step 1: normalize the raw input into a safe, consistent list.
  const safeUnits = normalizeUnits(units);
  const unitsByIdMap = new Map(
    safeUnits.map((candidate) => [candidate.id, candidate] as const),
  );

  // Step 2: resolve the target parent to the root when it is undefined/null.
  const targetParentId: string | null = targetUnitId ?? null;

  // Step 3: reject duplicate sibling names before checking ancestry.
  const duplicateSibling = safeUnits.some(
    (candidate) =>
      candidate.id !== unit.id &&
      candidate.parentId === targetParentId &&
      candidate.name === unit.name,
  );

  if (duplicateSibling) {
    throw new ConflictException(
      'A unit with this name already exists under the target parent',
    );
  }

  // Step 4: walk the target ancestry upward to confirm this move stays valid.
  const visited = new Set<string>();
  let ancestorId: string | null = targetParentId;

  while (ancestorId !== null) {
    // A unit cannot be moved into itself or one of its descendants.
    if (ancestorId === unit.id) {
      throw new ConflictException(
        'Cannot move a unit under itself or one of its descendants',
      );
    }

    // A loop means the hierarchy is cyclic, which is not allowed.
    if (visited.has(ancestorId)) {
      throw new ConflictException(
        'Cannot move a unit into a hierarchy that contains a cycle',
      );
    }

    visited.add(ancestorId);
    const ancestor = unitsByIdMap.get(ancestorId);

    // If the target parent does not exist in the current unit set, it is invalid.
    if (!ancestor) {
      throw new NotFoundException('Target parent unit not found');
    }

    // An inactive ancestor cannot be used as the destination.
    if (!ancestor.isActive) {
      throw new ForbiddenException('Cannot move a unit under an inactive unit');
    }

    // Continue upward until the root is reached.
    ancestorId = ancestor.parentId ?? null;
  }
}
