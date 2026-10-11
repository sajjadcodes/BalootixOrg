import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from './email.service.js';

const OWNER_SYSTEM_KEY = 'OWNER';
const OWNER_SETUP_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const INVALID_SETUP_LINK_MESSAGE = 'Owner setup link is invalid or expired';

@Injectable()
export class OwnerBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // The owner bootstrap flow is a one-time setup process that provisions 
  // the first privileged account for the platform. It consists of two main steps: 
  // issuing a secure invite and completing the setup with a password. 
  // The service ensures that only one OWNER can exist, and all operations are performed
  // in a transaction to maintain data integrity.
  async issueSetupInvite(input: {
    email: string;
    displayName: string;
  }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();

    if (!isEmail(email) || !displayName) {
      throw new BadRequestException(
        'A valid email and display name are required',
      );
    }

    // The platform must support exactly one system OWNER. This guard prevents a
    // second bootstrap flow from creating a duplicate privileged account.
    const ownerRole = await this.prisma.public.Role.where({
      systemKey: OWNER_SYSTEM_KEY,
    }).first();

    if (ownerRole) {
      throw new ConflictException(
        'An OWNER account has already been provisioned',
      );
    }

    // Generate a cryptographically random one-time token and hash it before storing
    // it. The raw value is only sent through email and never persisted in the DB.
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + OWNER_SETUP_TTL_MS).toISOString();

    await this.prisma.public.OwnerSetupToken.create({
      email,
      displayName,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    // Send the unencrypted setup token only to the target inbox.
    await this.emailService.sendOwnerSetupEmail(email, token);
  }

  // Completes the owner setup process by creating the initial owner account.
  async completeSetup(input: {
    token: string;
    password: string;
  }): Promise<{ completed: true }> {
    // Hash the incoming raw token so it matches the stored hash in the setup table.
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    // Hash the chosen password with bcrypt before creating the first account.
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const now = new Date().toISOString();

    // All owner creation steps happen in a single transaction.
    await this.prisma.client.transaction(async (tx) => {
      // Find the invite that matches this one-time token. If the token was never sent,
      // was already used, or is expired, the setup flow must fail closed.
      const setupToken = await tx.orm.public.OwnerSetupToken.where({
        tokenHash,
      }).first();

      if (
        !setupToken ||
        setupToken.usedAt !== null ||
        Date.parse(setupToken.expiresAt) <= Date.now()
      ) {
        throw new BadRequestException(INVALID_SETUP_LINK_MESSAGE);
      }

      // A second OWNER is never permitted, even if the first invite is stale or a race
      // occurs between two concurrent setup attempts. This is the final integrity check.
      const ownerRole = await tx.orm.public.Role.where({
        systemKey: OWNER_SYSTEM_KEY,
      }).first();

      if (ownerRole) {
        throw new ConflictException(
          'An OWNER account has already been provisioned',
        );
      }

      // Prevent the setup flow from creating a duplicate account if another user already
      // owns the same email address before the first owner is provisioned.
      const existingUser = await tx.orm.public.User.where({
        email: setupToken.email,
      }).first();

      if (existingUser) {
        throw new ConflictException('A user already exists with this email');
      }

      // Mark the invite consumed as part of the same transaction, so a token cannot be
      // used by two requests even under concurrent setup attempts.
      const consumedTokens = await tx.orm.public.OwnerSetupToken.where({
        tokenHash,
      }).updateAll({ usedAt: now });

      if (consumedTokens.length !== 1) {
        throw new BadRequestException(INVALID_SETUP_LINK_MESSAGE);
      }

      // Create the root management unit that all platform-wide roles can hang off.
      const systemUnit = await tx.orm.public.Unit.create({
        parentId: null,
        name: 'System',
        type: 'MANAGEMENT',
        description: 'System unit for platform roles',
        isActive: true,
      });

      // Create the first verified user for the platform owner account.
      const createdUser = await tx.orm.public.User.create({
        email: setupToken.email,
        displayName: setupToken.displayName,
        hashedPassword,
        isManager: false,
        emailVerifiedAt: now,
      });

      // Create the reserved OWNER role attached to the system unit.
      const createdRole = await tx.orm.public.Role.create({
        unitId: systemUnit.id,
        systemKey: OWNER_SYSTEM_KEY,
        name: 'Organization Owner',
        description: 'Reserved global platform owner role',
        scope: 'SELF',
        isActive: true,
      });

      // Link the newly created user to the reserved OWNER role
      await tx.orm.public.RoleAssignment.create({
        userId: createdUser.id,
        roleId: createdRole.id,
        isActive: true,
      });
    });

    // Signal the caller that the initial bootstrap completed successfully.
    return { completed: true };
  }
}
