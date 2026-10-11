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

    // Check if an OWNER role already exists
    const ownerRole = await this.prisma.public.Role.where({
      systemKey: OWNER_SYSTEM_KEY,
    }).first();

    if (ownerRole) {
      throw new ConflictException(
        'An OWNER account has already been provisioned',
      );
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + OWNER_SETUP_TTL_MS).toISOString();

    // Store the setup token in the database
    await this.prisma.public.OwnerSetupToken.create({
      email,
      displayName,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    // Send the setup email with the token
    await this.emailService.sendOwnerSetupEmail(email, token);
  }

  async completeSetup(input: {
    token: string;
    password: string;
  }): Promise<{ completed: true }> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const hashedPassword = await bcrypt.hash(input.password, 12);
    const now = new Date().toISOString();

    await this.prisma.client.transaction(async (tx) => {
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

      const ownerRole = await tx.orm.public.Role.where({
        systemKey: OWNER_SYSTEM_KEY,
      }).first();

      if (ownerRole) {
        throw new ConflictException(
          'An OWNER account has already been provisioned',
        );
      }

      const existingUser = await tx.orm.public.User.where({
        email: setupToken.email,
      }).first();

      if (existingUser) {
        throw new ConflictException('A user already exists with this email');
      }

      const consumedTokens = await tx.orm.public.OwnerSetupToken.where({
        tokenHash,
      }).updateAll({ usedAt: now });

      if (consumedTokens.length !== 1) {
        throw new BadRequestException(INVALID_SETUP_LINK_MESSAGE);
      }

      const systemUnit = await tx.orm.public.Unit.create({
        parentId: null,
        name: 'System',
        type: 'MANAGEMENT',
        description: 'System unit for platform roles',
        isActive: true,
      });

      const createdUser = await tx.orm.public.User.create({
        email: setupToken.email,
        displayName: setupToken.displayName,
        hashedPassword,
        isManager: false,
        emailVerifiedAt: now,
      });

      const createdRole = await tx.orm.public.Role.create({
        unitId: systemUnit.id,
        systemKey: OWNER_SYSTEM_KEY,
        name: 'Organization Owner',
        description: 'Reserved global platform owner role',
        scope: 'SELF',
        isActive: true,
      });

      await tx.orm.public.RoleAssignment.create({
        userId: createdUser.id,
        roleId: createdRole.id,
        isActive: true,
      });
    });

    return { completed: true };
  }
}
