import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { OwnerBootstrapService } from '../src/modules/auth/owner-bootstrap.service.js';

// This bootstrap script is the operator entry point for creating the first owner invite.
// It reads the email and display name from the command line, builds a Nest application
// context, and triggers the OwnerBootstrapService so the platform can send a one-time
// setup link without requiring any manual database edits.
async function bootstrapOwner(): Promise<void> {
  // Parse the CLI arguments into the target email and the rest of the name.
  // The display name may contain spaces, so each remaining argument is joined back together.
  const [email, ...displayNameParts] = process.argv.slice(2);
  const displayName = displayNameParts.join(' ').trim();

  // Fail fast if the required bootstrap input is missing so the operator knows the
  // exact command shape expected by the app.
  if (!email || !displayName) {
    throw new Error('Usage: pnpm owner:bootstrap -- <email> <display name>');
  }

  // Create a lightweight application context so we can resolve the Auth module and its
  // OwnerBootstrapService without booting the full HTTP server.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    // Resolve the bootstrap service from the app context and issue the invite.
    // The service is responsible for validating the request, storing a hashed token,
    // and sending the raw token to the user via email.
    const bootstrapService = app.select(AuthModule).get(OwnerBootstrapService);

    await bootstrapService.issueSetupInvite({ email, displayName });
    console.info('Owner setup invitation sent.');
  } finally {
    // Always close the app context to release resources even when the invite fails.
    await app.close();
  }
}

// Run the bootstrap flow and surface a clear error message if the invite cannot be sent.
bootstrapOwner().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
