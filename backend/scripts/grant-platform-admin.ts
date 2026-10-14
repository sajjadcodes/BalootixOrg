import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { OwnerBootstrapService } from '../src/modules/auth/owner-bootstrap.service.js';

async function grantPlatformAdmin(): Promise<void> {
  const [email] = process.argv.slice(2);

  if (!email) {
    throw new Error(
      'Usage: pnpm owner:grant-platform-admin -- <platform-user-email>',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ownerBootstrapService = app
      .select(AuthModule)
      .get(OwnerBootstrapService);
    const result = await ownerBootstrapService.grantPlatformAdmin(email);

    console.info(
      result.granted
        ? `Platform-admin access granted to ${email.trim().toLowerCase()}.`
        : `Platform-admin access is already active for ${email.trim().toLowerCase()}.`,
    );
  } finally {
    await app.close();
  }
}

grantPlatformAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
