import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { GlobalAdminGuard } from '../authorization/guards/global-admin.guard.js';
import { PlatformAdminController } from './platform-admin.controller.js';
import { PlatformAdminService } from './platform-admin.service.js';

@Module({
  imports: [PrismaModule],
  providers: [PlatformAdminService, GlobalAdminGuard],
  controllers: [PlatformAdminController],
  exports: [GlobalAdminGuard],
})
export class PlatformAdminModule {}
