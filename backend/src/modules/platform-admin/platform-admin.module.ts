import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GlobalAdminGuard } from '../authorization/guards/global-admin.guard.js';
import { PlatformAdminController } from './platform-admin.controller.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { TenantProvisioningService } from './tenant-provisioning.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [PlatformAdminService, TenantProvisioningService, GlobalAdminGuard],
  controllers: [PlatformAdminController],
  exports: [GlobalAdminGuard],
})
export class PlatformAdminModule {}
