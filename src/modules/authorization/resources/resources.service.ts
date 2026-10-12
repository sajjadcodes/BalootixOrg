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
  async createResource(input: CreateResourceDto): Promise<ResourceData> {
    const route = normalizeRoute(input.route);

    const existing = await this.prisma.public.Resource.where({ route }).first();

    if (existing) {
      throw new ConflictException('A resource with this route already exists');
    }

    const tenant = await this.prisma.public.Tenant.orderBy((item) =>
      item.createdAt.asc(),
    ).first();

    if (!tenant) {
      throw new NotFoundException('No tenant is available for this resource');
    }

    return this.prisma.public.Resource.create({
      tenantId: tenant.id,
      route,
    });
  }

  //READ RESOURCE
  async listResources(): Promise<ResourceData[]> {
    return await this.prisma.public.Resource.orderBy((resource) =>
      resource.route.asc(),
    ).all();
  }

  //READ RESOURCE BY ID
  async getResource(id: string): Promise<ResourceData> {
    const resource = await this.prisma.public.Resource.where({ id }).first();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  //UPDATE RESOURCE
  async updateResource(
    id: string,
    input: UpdateResourceDto,
  ): Promise<ResourceData> {
    const existing = await this.prisma.public.Resource.where({ id }).first();

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    const route =
      input.route === undefined ? existing.route : normalizeRoute(input.route);

    if (input.route !== undefined) {
      const duplicate = await this.prisma.public.Resource.where({
        route,
      }).first();

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'A resource with this route already exists',
        );
      }
    }

    const updated = await this.prisma.public.Resource.where({ id }).update({
      route,
    });

    // If no row is returned, the resource was removed while updating.
    if (!updated) {
      throw new NotFoundException('Resource not found');
    }

    return updated;
  }

  //DELETE RESOURCE
  async deleteResource(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.public.Resource.where({ id }).first();

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    // Preserve permissions and role assignments that depend on this resource.
    const permission = await this.prisma.public.Permission.where({
      resourceId: id,
    }).first();

    if (permission) {
      throw new ConflictException(
        'Cannot delete a resource while permissions are assigned to it',
      );
    }

    // Delete the resource only after confirming it has no permissions.
    await this.prisma.public.Resource.where({ id }).delete();

    return { deleted: true };
  }
}
