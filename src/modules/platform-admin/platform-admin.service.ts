import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserData } from '../users/types/user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantData, TenantStatus } from './types/platform-admin.js';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(status?: TenantStatus): Promise<TenantData[]> {
    const filters = status ? { status } : {};
    const tenants = await this.prisma.public.Tenant.where(filters).all();

    return tenants.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    }));
  }

  async getTenant(tenantId: string): Promise<TenantData> {
    const tenant = await this.prisma.public.Tenant.where({
      id: tenantId,
    }).first();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async listTenantUsers(tenantId: string): Promise<UserData[]> {
    const users = await this.prisma.public.User.where({ tenantId }).all();

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      mobile: user.mobile,
      isManager: user.isManager,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }
}
