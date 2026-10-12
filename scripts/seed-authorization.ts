import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { AuthorizationModule } from '../src/modules/authorization/authorization.module.js';
import { AUTHORIZATION_PERMISSION_KEY } from '../src/modules/authorization/decorators/require-permission.decorator.js';
import { collectAuthorizationSeedPermissions } from '../src/modules/authorization/authorization-seed-catalog.js';
import { AuthorizationSeedService } from '../src/modules/authorization/authorization-seed.service.js';
import { PermissionsController } from '../src/modules/authorization/permissions/permissions.controller.js';
import { ResourcesController } from '../src/modules/authorization/resources/resources.controller.js';
import { RoleAssignmentsController } from '../src/modules/authorization/role-assignments/role-assignments.controller.js';
import { RolePermissionsController } from '../src/modules/authorization/role-permissions/role-permissions.controller.js';
import { RolesController } from '../src/modules/authorization/roles/roles.controller.js';
import { UnitsController } from '../src/modules/units/units.controller.js';
import { UsersController } from '../src/modules/users/users.controller.js';

const controllers = [
  AuthController,
  UnitsController,
  UsersController,
  ResourcesController,
  PermissionsController,
  RolesController,
  RoleAssignmentsController,
  RolePermissionsController,
];

async function seedAuthorization(): Promise<void> {
  const [tenantId] = process.argv.slice(2);
  if (!tenantId) {
    throw new Error('Usage: pnpm authorization:seed -- <tenantId>');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const seedService = app
      .select(AuthorizationModule)
      .get(AuthorizationSeedService);
    const catalog = collectAuthorizationSeedPermissions(
      controllers,
      AUTHORIZATION_PERMISSION_KEY,
    );
    const result = await seedService.seedTenant(tenantId, catalog);
    console.info(`Authorization seed completed for tenant ${tenantId}.`);
    console.info(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

seedAuthorization().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Authorization seed failed',
  );
  process.exitCode = 1;
});
