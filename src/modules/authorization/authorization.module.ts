import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationGuard } from './guards/authorization.guard.js';
import { GlobalAdminGuard } from './guards/global-admin.guard.js';
import { PermissionsController } from './permissions/permissions.controller.js';
import { PermissionsService } from './permissions/permissions.service.js';
import { RoleAssignmentsController } from './role-assignments/role-assignments.controller.js';
import { RoleAssignmentsService } from './role-assignments/role-assignments.service.js';
import { RolePermissionsController } from './role-permissions/role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions/role-permissions.service.js';
import { ResourcesController } from './resources/resources.controller.js';
import { ResourcesService } from './resources/resources.service.js';
import { RolesController } from './roles/roles.controller.js';
import { RolesService } from './roles/roles.service.js';
import { AuthorizationSeedService } from './authorization-seed.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    ResourcesController,
    PermissionsController,
    RolesController,
    RolePermissionsController,
    RoleAssignmentsController,
  ],
  providers: [
    ResourcesService,
    PermissionsService,
    RolesService,
    RolePermissionsService,
    RoleAssignmentsService,
    AuthorizationService,
    AuthorizationGuard,
    GlobalAdminGuard,
    AuthorizationSeedService,
  ],
  exports: [
    AuthorizationService,
    AuthorizationGuard,
    GlobalAdminGuard,
    AuthorizationSeedService,
  ],
})
export class AuthorizationModule {}
