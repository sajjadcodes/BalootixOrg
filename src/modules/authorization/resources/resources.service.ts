import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { CreateResourceDto } from './dto/create-resource.dto.js';
import { UpdateResourceDto } from './dto/update-resource.dto.js';
import type { ResourceData } from './types/resource.js';
import { normalizeRoute } from '../utils/string.js';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  //CREATE RESOURCE
  async createResource(
    input: CreateResourceDto,
    tenantId?: string,
  ): Promise<ResourceData> {
    const route = normalizeRoute(input.route);

    const existing = await this.prisma.public.Resource.where({
      route,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (existing) {
      throw new ConflictException('A resource with this route already exists');
    }

    const effectiveTenantId =
      tenantId ??
      (
        await this.prisma.public.Tenant.orderBy((item) =>
          item.createdAt.asc(),
        ).first()
      )?.id;

    if (!effectiveTenantId) {
      throw new NotFoundException('No tenant is available for this resource');
    }

    return this.prisma.public.Resource.create({
      tenantId: effectiveTenantId,
      route,
    });
  }

  //READ RESOURCE
  async listResources(tenantId?: string): Promise<ResourceData[]> {
    const query = tenantId
      ? this.prisma.public.Resource.where({ tenantId })
      : this.prisma.public.Resource;

    const resources = await query.all();
    return [...resources].sort((a, b) => a.route.localeCompare(b.route));
  }

  //READ RESOURCE BY ID
  async getResource(id: string, tenantId?: string): Promise<ResourceData> {
    const resource = await this.prisma.public.Resource.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  //UPDATE RESOURCE
  async updateResource(
    id: string,
    input: UpdateResourceDto,
    tenantId?: string,
  ): Promise<ResourceData> {
    const existing = await this.prisma.public.Resource.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    const route =
      input.route === undefined ? existing.route : normalizeRoute(input.route);

    if (input.route !== undefined) {
      const duplicate = await this.prisma.public.Resource.where({
        route,
        tenantId: existing.tenantId,
      }).first();

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'A resource with this route already exists',
        );
      }
    }

    const updated = await this.prisma.public.Resource.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).update({
      route,
    });

    if (!updated) {
      throw new NotFoundException('Resource not found');
    }

    return updated;
  }

  //DELETE RESOURCE
  async deleteResource(
    id: string,
    tenantId?: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Resource.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    const permission = await this.prisma.public.Permission.where({
      resourceId: id,
      ...(tenantId ? { tenantId } : {}),
    }).first();

    if (permission) {
      throw new ConflictException(
        'Cannot delete a resource while permissions are assigned to it',
      );
    }

    await this.prisma.public.Resource.where({
      id,
      ...(tenantId ? { tenantId } : {}),
    }).delete();

    return { deleted: true };
  }
}
