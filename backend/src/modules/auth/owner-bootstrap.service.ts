import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from './email.service.js';
import { normalizeTenantSlug } from '../platform-admin/tenant-slug.js';

const OWNER_SYSTEM_KEY = 'OWNER';
const OWNER_SETUP_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const INVALID_SETUP_LINK_MESSAGE = 'Owner setup link is invalid or expired';

@Injectable()
export class OwnerBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // The owner flow provisions privileged accounts from a secure one-time invite:
  // the platform operator (a GlobalAdmin) and, per customer organization, its OWNER.
  // All completion steps run in a single transaction to maintain data integrity.
  private async ensurePlatformTenant() {
    const existing = await this.prisma.public.Tenant.orderBy((tenant) =>
      tenant.createdAt.asc(),
    ).first();

    if (existing) {
      return existing;
    }

    return this.prisma.public.Tenant.create({
      slug: normalizeTenantSlug(`platform-${Date.now()}`),
      name: 'Platform Tenant',
      status: 'ACTIVE',
    });
  }
  // The platform tenant is the oldest tenant. It only holds the platform
  // operator (a GlobalAdmin); customer organizations are always created later.
  private async getPlatformTenantId(): Promise<string | null> {
    const platformTenant = await this.prisma.public.Tenant.orderBy((tenant) =>
      tenant.createdAt.asc(),
    ).first();

    return platformTenant?.id ?? null;
  }

  // Issues the one-time invite for the platform operator (global admin).
  async issueSetupInvite(input: {
    email: string;
    displayName: string;
  }): Promise<void> {
    const { email, displayName } = this.parseInviteInput(input);

    // Only one platform operator is bootstrapped this way. Further global admins
    // are a deliberate action and not part of this flow.
    const existingAdmin = await this.prisma.public.GlobalAdmin.where({
      isActive: true,
    }).first();

    if (existingAdmin) {
      throw new ConflictException(
        'A platform admin has already been provisioned',
      );
    }

    const tenant = await this.ensurePlatformTenant();
    await this.createAndSendInvite(tenant.id, email, displayName);
  }

  // Issues the one-time invite that makes `email` the OWNER of a customer
  // organization. Called by platform admins when provisioning or re-inviting.
  async issueTenantOwnerInvite(input: {
    tenantId: string;
    email: string;
    displayName: string;
  }): Promise<void> {
    const { email, displayName } = this.parseInviteInput(input);

    const platformTenantId = await this.getPlatformTenantId();
    if (input.tenantId === platformTenantId) {
      throw new BadRequestException(
        'The platform tenant cannot have an organization owner',
      );
    }

    const tenant = await this.prisma.public.Tenant.where({
      id: input.tenantId,
    }).first();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const ownerRole = await this.prisma.public.Role.where({
      tenantId: tenant.id,
      systemKey: OWNER_SYSTEM_KEY,
    }).first();

    if (ownerRole) {
      throw new ConflictException('This organization already has an owner');
    }

    const existingUser = await this.prisma.public.User.where({ email }).first();
    if (existingUser) {
      throw new ConflictException('A user already exists with this email');
    }

    await this.createAndSendInvite(tenant.id, email, displayName);
  }

  private parseInviteInput(input: { email: string; displayName: string }) {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();

    if (!isEmail(email) || !displayName) {
      throw new BadRequestException(
        'A valid email and display name are required',
      );
    }

    return { email, displayName };
  }

  private async createAndSendInvite(
    tenantId: string,
    email: string,
    displayName: string,
  ): Promise<void> {
    // Generate a cryptographically random one-time token and hash it before storing
    // it. The raw value is only sent through email and never persisted in the DB.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + OWNER_SETUP_TTL_MS).toISOString();

    await this.prisma.public.OwnerSetupToken.create({
      tenantId,
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

      const isPlatformSetup =
        setupToken.tenantId === (await this.getPlatformTenantId());

      // Prevent the setup flow from creating a duplicate account if another user already
      // owns the same email address.
      const existingUser = await tx.orm.public.User.where({
        email: setupToken.email,
      }).first();

      if (existingUser) {
        throw new ConflictException('A user already exists with this email');
      }

      const existingGlobalAdmin = await tx.orm.public.GlobalAdmin.where({
        email: setupToken.email,
      }).first();

      if (existingGlobalAdmin) {
        throw new ConflictException(
          'A platform admin already exists with this email',
        );
      }

      if (isPlatformSetup) {
        const activeAdmin = await tx.orm.public.GlobalAdmin.where({
          isActive: true,
        }).first();

        if (activeAdmin) {
          throw new ConflictException(
            'A platform admin has already been provisioned',
          );
        }
      } else {
        // An organization has exactly one system OWNER. This is the final integrity
        // check against stale invites and concurrent setup attempts.
        const ownerRole = await tx.orm.public.Role.where({
          tenantId: setupToken.tenantId,
          systemKey: OWNER_SYSTEM_KEY,
        }).first();

        if (ownerRole) {
          throw new ConflictException(
            'This organization already has an owner',
          );
        }
      }

      // Mark the invite consumed as part of the same transaction, so a token cannot be
      // used by two requests even under concurrent setup attempts.
      const consumedTokens = await tx.orm.public.OwnerSetupToken.where({
        tokenHash,
      }).updateAll({ usedAt: now });

      if (consumedTokens.length !== 1) {
        throw new BadRequestException(INVALID_SETUP_LINK_MESSAGE);
      }

      // Create the verified user. The invite email proves ownership of the address.
      const createdUser = await tx.orm.public.User.create({
        tenantId: setupToken.tenantId,
        email: setupToken.email,
        displayName: setupToken.displayName,
        hashedPassword,
        isManager: false,
        emailVerifiedAt: now,
      });

      if (isPlatformSetup) {
        // The platform operator is only a GlobalAdmin. It holds no organization role
        // and never owns a customer organization.
        await tx.orm.public.GlobalAdmin.create({
          email: createdUser.email,
          displayName: createdUser.displayName,
          hashedPassword: null,
          isActive: true,
        });

        return;
      }

      // Customer organization: create its root unit, OWNER role and assignment.
      const rootUnit = await tx.orm.public.Unit.create({
        tenantId: setupToken.tenantId,
        parentId: null,
        name: 'Organization',
        type: 'MANAGEMENT',
        description: 'Root unit of the organization',
        isActive: true,
      });

      const createdRole = await tx.orm.public.Role.create({
        tenantId: setupToken.tenantId,
        unitId: rootUnit.id,
        systemKey: OWNER_SYSTEM_KEY,
        name: 'Organization Owner',
        description: 'Reserved organization owner role',
        scope: 'DESCENDANTS',
        isActive: true,
      });

      await tx.orm.public.RoleAssignment.create({
        tenantId: setupToken.tenantId,
        userId: createdUser.id,
        roleId: createdRole.id,
        isActive: true,
      });
    });

    // Signal the caller that the initial bootstrap completed successfully.
    return { completed: true };
  }

  // Recovery path for the platform operator: grants platform-admin access to a
  // verified user that lives in the platform tenant (e.g. an account created
  // before the GlobalAdmin split). Customer-organization users are rejected.
  async grantPlatformAdmin(emailInput: string): Promise<{
    granted: boolean;
  }> {
    const email = emailInput.trim().toLowerCase();

    if (!isEmail(email)) {
      throw new BadRequestException('A valid email is required');
    }

    const platformTenantId = await this.getPlatformTenantId();

    return this.prisma.client.transaction(async (tx) => {
      const user = await tx.orm.public.User.where({ email }).first();

      if (
        !user ||
        !user.emailVerifiedAt ||
        user.tenantId !== platformTenantId
      ) {
        throw new BadRequestException(
          'A verified user in the platform tenant is required',
        );
      }

      const existingAdmin = await tx.orm.public.GlobalAdmin.where({
        email,
      }).first();

      if (existingAdmin?.isActive) {
        return { granted: false };
      }

      if (existingAdmin) {
        throw new ConflictException(
          'A platform admin record exists but is inactive',
        );
      }

      await tx.orm.public.GlobalAdmin.create({
        email: user.email,
        displayName: user.displayName,
        hashedPassword: null,
        isActive: true,
      });

      return { granted: true };
    });
  }
}
