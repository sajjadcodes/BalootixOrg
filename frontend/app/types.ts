export interface LoginUserData {
  id: string;
  email: string;
  displayName: string;
  isManager: boolean;
  mobile: string | null;
  avatar: string | null;
  tenantId: string;
  isGlobalAdmin: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionData {
  plan: "TRIAL" | "STARTER" | "GROWTH" | "ENTERPRISE";
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
}

export interface UserData {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  mobile: string | null;
  isManager: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
