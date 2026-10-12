import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserData } from '../users/types/user.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GlobalAdminGuard } from '../authorization/guards/global-admin.guard.js';
import type { TenantData } from './types/platform-admin.js';
import { PlatformAdminService } from './platform-admin.service.js';

@ApiTags('Platform Admin')
@Controller('platform-admin')
@UseGuards(JwtAuthGuard, GlobalAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('tenants')
  listTenants(): Promise<TenantData[]> {
    return this.platformAdminService.listTenants();
  }

  @Get('tenants/:tenantId')
  getTenant(@Param('tenantId') tenantId: string): Promise<TenantData> {
    return this.platformAdminService.getTenant(tenantId);
  }

  @Get('tenants/:tenantId/users')
  listTenantUsers(@Param('tenantId') tenantId: string): Promise<UserData[]> {
    return this.platformAdminService.listTenantUsers(tenantId);
  }
}
