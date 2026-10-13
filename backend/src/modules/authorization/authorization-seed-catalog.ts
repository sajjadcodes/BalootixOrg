import 'reflect-metadata';
import type { AuthorizationPermissionMetadata } from './decorators/require-permission.decorator.js';
import type { SeedPermission } from './authorization-seed.service.js';

export function collectAuthorizationSeedPermissions(
  controllers: readonly { prototype: object }[],
  metadataKey: string,
): SeedPermission[] {
  const permissionsByKey = new Map<string, SeedPermission>();

  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, unknown>;

    for (const methodName of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = prototype[methodName];
      if (typeof handler !== 'function') {
        continue;
      }

      const metadata = Reflect.getMetadata(metadataKey, handler) as
        AuthorizationPermissionMetadata | undefined;

      if (!metadata) {
        continue;
      }

      permissionsByKey.set(`${metadata.resource}\0${metadata.action}`, {
        resource: metadata.resource,
        action: metadata.action,
      });
    }
  }

  return [...permissionsByKey.values()].sort((left, right) =>
    `${left.resource}\0${left.action}`.localeCompare(
      `${right.resource}\0${right.action}`,
    ),
  );
}
