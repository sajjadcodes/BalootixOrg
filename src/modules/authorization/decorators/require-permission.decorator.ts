import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '../permissions/types/permission.js';

// This is the metadata key used by the guard to detect which permission the route requires.
export const AUTHORIZATION_PERMISSION_KEY = 'authorization:permission';

export interface AuthorizationPermissionMetadata {
  resource: string;
  action: PermissionAction;
}

// Attach permission metadata to a controller method so the guard can look it up later.
export const RequirePermission = (resource: string, action: PermissionAction) =>
  SetMetadata(AUTHORIZATION_PERMISSION_KEY, {
    resource,
    action,
  });
