export enum PermissionActionEnum {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// Keep enum values compatible with Prisma string unions and incoming DTO strings.
export type PermissionAction = `${PermissionActionEnum}`;

export interface PermissionData {
  id: string;
  resourceId: string;
  action: PermissionAction;
  createdAt: string;
  updatedAt: string;
}
