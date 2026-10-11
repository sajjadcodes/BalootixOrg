export enum RoleScopeEnum {
  SELF = 'SELF',
  DESCENDANTS = 'DESCENDANTS',
}

// Keep enum values compatible with Prisma string unions and incoming DTO strings.
export type RoleScope = `${RoleScopeEnum}`;

export interface RoleData {
  id: string;
  unitId: string;
  systemKey: string | null;
  name: string;
  description: string | null;
  scope: RoleScope;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
