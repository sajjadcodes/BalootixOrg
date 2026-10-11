import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { OwnerBootstrapService } from '../src/modules/auth/owner-bootstrap.service.js';

// This script is used to bootstrap the owner setup process for the application. 
// It takes an email and display name as command-line arguments, 
// creates an application context, and invokes the OwnerBootstrapService to issue 
// a setup invitation for the owner. If the required arguments are not provided, 
// it throws an error with usage instructions.
async function bootstrapOwner(): Promise<void> {
  const [email, ...displayNameParts] = process.argv.slice(2);

  const displayName = displayNameParts.join(' ').trim();

  if (!email || !displayName) {
    throw new Error('Usage: pnpm owner:bootstrap -- <email> <display name>');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const bootstrapService = app.select(AuthModule).get(OwnerBootstrapService);

    await bootstrapService.issueSetupInvite({ email, displayName });
    console.info('Owner setup invitation sent.');
  } finally {
    await app.close();
  }
}

bootstrapOwner().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Owner setup failed');
  process.exitCode = 1;
});
