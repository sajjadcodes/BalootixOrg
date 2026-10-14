import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import type { PaginatedResult } from '../../common/types/paginated-result.js';
import type { UserData } from '../users/types/user.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GlobalAdminGuard } from '../authorization/guards/global-admin.guard.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { InviteTenantOwnerDto } from './dto/invite-tenant-owner.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto.js';
import type { TenantData } from './types/platform-admin.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { TenantProvisioningService } from './tenant-provisioning.service.js';

@ApiTags('Platform Admin')
@Controller('platform-admin')
@UseGuards(JwtAuthGuard, GlobalAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly platformAdminService: PlatformAdminService,
    private readonly tenantProvisioningService: TenantProvisioningService,
  ) {}

  @Post('tenants')
  createTenant(@Body() input: CreateTenantDto) {
    return this.tenantProvisioningService.createTenant(input);
  }

  @Post('tenants/:tenantId/owner-invite')
  @HttpCode(HttpStatus.OK)
  inviteTenantOwner(
    @Param('tenantId') tenantId: string,
    @Body() input: InviteTenantOwnerDto,
  ) {
    return this.tenantProvisioningService.resendOwnerInvite(tenantId, input);
  }

  @Patch('tenants/:tenantId/status')
  updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body() input: UpdateTenantStatusDto,
  ) {
    return this.tenantProvisioningService.updateTenantStatus(
      tenantId,
      input.status,
    );
  }

  @Get('tenants/:tenantId/subscription')
  getSubscription(@Param('tenantId') tenantId: string) {
    return this.tenantProvisioningService.getSubscription(tenantId);
  }

  @Patch('tenants/:tenantId/subscription')
  updateSubscription(
    @Param('tenantId') tenantId: string,
    @Body() input: UpdateSubscriptionDto,
  ) {
    return this.tenantProvisioningService.updateSubscription(tenantId, input);
  }

  @Get('tenants')
  listTenants(
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<TenantData>> {
    return this.platformAdminService.listTenants(query);
  }

  @Get('tenants/:tenantId')
  getTenant(@Param('tenantId') tenantId: string): Promise<TenantData> {
    return this.platformAdminService.getTenant(tenantId);
  }

  @Get('tenants/:tenantId/users')
  listTenantUsers(
    @Param('tenantId') tenantId: string,
    @Query() query: ListQueryDto = new ListQueryDto(),
  ): Promise<PaginatedResult<UserData>> {
    return this.platformAdminService.listTenantUsers(tenantId, query);
  }
}
