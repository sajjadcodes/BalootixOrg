export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';

export interface TenantData {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}
