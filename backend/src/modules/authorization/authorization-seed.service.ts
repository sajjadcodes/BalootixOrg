import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PermissionAction } from './permissions/types/permission.js';

export interface SeedPermission {
  resource: string;
  action: PermissionAction;
}

export interface AuthorizationSeedResult {
  resourcesProcessed: number;
  permissionsProcessed: number;
}

@Injectable()
export class AuthorizationSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seedTenant(
    tenantId: string,
    catalog: readonly SeedPermission[],
  ): Promise<AuthorizationSeedResult> {
    if (!tenantId.trim()) {
      throw new Error('A tenant ID is required');
    }

    const resourceRoutes = [
      ...new Set(catalog.map(({ resource }) => resource)),
    ];

    return this.prisma.client.transaction(async (tx) => {
      const tenant = await tx.orm.public.Tenant.where({ id: tenantId }).first();
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const resourcesByRoute = new Map<string, { id: string }>();
      let resourcesProcessed = 0;
      let permissionsProcessed = 0;

      for (const route of resourceRoutes) {
        let resource = await tx.orm.public.Resource.where({
          tenantId,
          route,
        }).first();

        if (!resource) {
          resource = await tx.orm.public.Resource.create({ tenantId, route });
        }

        resourcesByRoute.set(route, resource);
        resourcesProcessed += 1;
      }

      for (const { resource: route, action } of catalog) {
        const resource = resourcesByRoute.get(route);
        if (!resource) {
          throw new Error(`Seed resource missing for route ${route}`);
        }

        let permission = await tx.orm.public.Permission.where({
          tenantId,
          resourceId: resource.id,
          action,
        }).first();

        if (!permission) {
          permission = await tx.orm.public.Permission.create({
            tenantId,
            resourceId: resource.id,
            action,
          });
        }

        permissionsProcessed += 1;
      }

      return {
        resourcesProcessed,
        permissionsProcessed,
      };
    });
  }
}
