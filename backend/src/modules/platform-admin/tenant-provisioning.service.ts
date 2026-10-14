import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OwnerBootstrapService } from '../auth/owner-bootstrap.service.js';
import { normalizeTenantSlug } from './tenant-slug.js';
import type { CreateTenantDto } from './dto/create-tenant.dto.js';
import type { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  TenantData,
  TenantStatus,
  TenantSubscriptionSummary,
} from './types/platform-admin.js';

const TRIAL_DAYS = 14;
const BILLING_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProvisionedTenantData {
  tenant: TenantData;
  subscription: TenantSubscriptionSummary;
}

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerBootstrapService: OwnerBootstrapService,
  ) {}

  // Creates a customer organization with its subscription and emails the invite
  // that turns the given address into the organization's OWNER.
  async createTenant(input: CreateTenantDto): Promise<ProvisionedTenantData> {
    const name = input.name.trim();
    const slug = normalizeTenantSlug(input.slug);
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const ownerDisplayName = input.ownerDisplayName.trim();
    const plan: SubscriptionPlan = input.plan ?? 'TRIAL';

    if (!isEmail(ownerEmail) || !name || !ownerDisplayName) {
      throw new BadRequestException(
        'Name, owner email and owner display name are required',
      );
    }

    if (await this.prisma.public.Tenant.where({ slug }).first()) {
      throw new ConflictException('A tenant with this slug already exists');
    }

    // Fail before creating anything when the owner address is already taken.
    if (
      (await this.prisma.public.User.where({ email: ownerEmail }).first()) ||
      (await this.prisma.public.GlobalAdmin.where({
        email: ownerEmail,
      }).first())
    ) {
      throw new ConflictException('A user already exists with this email');
    }

    const isTrial = plan === 'TRIAL';
    const subscriptionStatus: SubscriptionStatus = isTrial ? 'TRIAL' : 'ACTIVE';
    const tenantStatus: TenantStatus = isTrial ? 'TRIAL' : 'ACTIVE';
    const periodStart = new Date();
    const periodEnd = new Date(
      periodStart.getTime() +
        (isTrial ? TRIAL_DAYS : BILLING_PERIOD_DAYS) * DAY_MS,
    );

    const created = await this.prisma.client.transaction(async (tx) => {
      const tenant = await tx.orm.public.Tenant.create({
        slug,
        name,
        status: tenantStatus,
      });

      const subscription = await tx.orm.public.Subscription.create({
        tenantId: tenant.id,
        plan,
        status: subscriptionStatus,
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      });

      return { tenant, subscription };
    });

    try {
      await this.ownerBootstrapService.issueTenantOwnerInvite({
        tenantId: created.tenant.id,
        email: ownerEmail,
        displayName: ownerDisplayName,
      });
    } catch (error) {
      this.logger.warn(`Owner invite failed for tenant ${created.tenant.id}`);
      throw new ServiceUnavailableException(
        `Tenant ${created.tenant.id} was created but the owner invite could not be sent. Re-send it from the tenant page.`,
        { cause: error },
      );
    }

    return {
      tenant: this.toTenantData(created.tenant),
      subscription: this.toSubscriptionSummary(created.subscription),
    };
  }

  async resendOwnerInvite(
    tenantId: string,
    input: { ownerEmail: string; ownerDisplayName: string },
  ): Promise<{ sent: true }> {
    await this.ownerBootstrapService.issueTenantOwnerInvite({
      tenantId,
      email: input.ownerEmail,
      displayName: input.ownerDisplayName,
    });

    return { sent: true };
  }

  async updateTenantStatus(
    tenantId: string,
    status: TenantStatus,
  ): Promise<TenantData> {
    await this.assertCustomerTenant(tenantId);

    await this.prisma.public.Tenant.where({ id: tenantId }).updateAll({
      status,
    });

    const tenant = await this.prisma.public.Tenant.where({
      id: tenantId,
    }).first();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.toTenantData(tenant);
  }

  async getSubscription(
    tenantId: string,
  ): Promise<TenantSubscriptionSummary | null> {
    await this.assertCustomerTenant(tenantId);

    const subscription = await this.prisma.public.Subscription.where({
      tenantId,
    }).first();

    return subscription ? this.toSubscriptionSummary(subscription) : null;
  }

  async updateSubscription(
    tenantId: string,
    input: UpdateSubscriptionDto,
  ): Promise<TenantSubscriptionSummary> {
    await this.assertCustomerTenant(tenantId);

    const existing = await this.prisma.public.Subscription.where({
      tenantId,
    }).first();

    if (!existing) {
      const created = await this.prisma.public.Subscription.create({
        tenantId,
        plan: input.plan ?? 'TRIAL',
        status: input.status ?? 'TRIAL',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      });

      return this.toSubscriptionSummary(created);
    }

    const changes: Record<string, string> = {};
    if (input.plan) changes.plan = input.plan;
    if (input.status) changes.status = input.status;
    if (input.currentPeriodEnd) {
      changes.currentPeriodEnd = new Date(input.currentPeriodEnd).toISOString();
    }

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    await this.prisma.public.Subscription.where({ tenantId }).updateAll(
      changes,
    );

    const updated = await this.prisma.public.Subscription.where({
      tenantId,
    }).first();

    if (!updated) {
      throw new NotFoundException('Subscription not found');
    }

    return this.toSubscriptionSummary(updated);
  }

  // The platform tenant (oldest tenant) hosts only the operator account and is
  // never managed as a customer organization.
  private async assertCustomerTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.public.Tenant.where({
      id: tenantId,
    }).first();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const platformTenant = await this.prisma.public.Tenant.orderBy((t) =>
      t.createdAt.asc(),
    ).first();

    if (platformTenant?.id === tenantId) {
      throw new BadRequestException(
        'The platform tenant cannot be managed as an organization',
      );
    }
  }

  private toTenantData(tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }): TenantData {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status as TenantStatus,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private toSubscriptionSummary(subscription: {
    plan: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAt: string | null;
  }): TenantSubscriptionSummary {
    return {
      plan: subscription.plan as SubscriptionPlan,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAt: subscription.cancelAt,
    };
  }
}
