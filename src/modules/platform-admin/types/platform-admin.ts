import type { PaginatedResult } from '../../../common/types/paginated-result.js';

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
export type SubscriptionPlan = 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type SubscriptionStatus =
  'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionSummary {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
}

export interface TenantUsageSummary {
  userCount: number;
  verifiedUserCount: number;
  unitCount: number;
  activeUnitCount: number;
  roleCount: number;
  activeRoleCount: number;
}

export interface TenantAdminListItem extends TenantData {
  subscription: TenantSubscriptionSummary | null;
  usage: TenantUsageSummary;
}

export interface PlatformAdminDashboardData {
  generatedAt: string;
  tenantCount: number;
  tenantCountsByStatus: Record<TenantStatus, number>;
  subscriptionCountsByStatus: Record<SubscriptionStatus, number>;
  tenantsWithoutSubscription: number;
  usage: TenantUsageSummary;
  tenants: PaginatedResult<TenantAdminListItem>;
}
