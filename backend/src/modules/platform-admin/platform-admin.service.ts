import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserData } from '../users/types/user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../common/types/paginated-result.js';
import { paginateListQuery } from '../../common/utils/list-query.js';
import type { TenantData, TenantStatus } from './types/platform-admin.js';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(
    input: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<TenantData>> {
    const validStatuses: TenantStatus[] = [
      'ACTIVE',
      'TRIAL',
      'SUSPENDED',
      'ARCHIVED',
    ];
    if (input.status && !validStatuses.includes(input.status as TenantStatus)) {
      throw new BadRequestException('Invalid tenant status filter');
    }

    const result = await paginateListQuery<TenantData>(
      this.prisma.public.Tenant,
      input,
      {
        defaultSortBy: 'name',
        sortFields: {
          name: 'name',
          slug: 'slug',
          status: 'status',
          createdAt: 'createdAt',
        },
        filters: { status: 'status', slug: 'slug' },
      },
    );

    return {
      ...result,
      items: result.items.map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      })),
    };
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

  async listTenantUsers(
    tenantId: string,
    input: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<UserData>> {
    const result = await paginateListQuery<UserData>(
      this.prisma.public.User,
      input,
      {
        tenantId,
        defaultSortBy: 'displayName',
        sortFields: {
          displayName: 'displayName',
          email: 'email',
          createdAt: 'createdAt',
        },
        filters: {
          email: { field: 'email', normalize: 'email' },
          displayName: 'displayName',
          isManager: 'isManager',
          emailVerified: { field: 'emailVerifiedAt', nullable: true },
        },
      },
    );

    return {
      ...result,
      items: result.items.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        mobile: user.mobile,
        isManager: user.isManager,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
  }
}
