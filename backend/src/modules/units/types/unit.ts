export enum UnitTypeEnum {
  TEAM = 'TEAM',
  DEPARTMENT = 'DEPARTMENT',
  MANAGEMENT = 'MANAGEMENT',
}

// Keep enum values compatible with Prisma string unions and incoming DTO strings.
export type UnitType = `${UnitTypeEnum}`;

export interface UnitData {
  id: string;
  parentId: string | null;
  name: string;
  type: UnitType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UnitTreeNode = UnitData & {
  children: UnitTreeNode[];
};
