import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { TenantStatus } from '../types/platform-admin.js';

export const TENANT_STATUSES: TenantStatus[] = [
  'ACTIVE',
  'TRIAL',
  'SUSPENDED',
  'ARCHIVED',
];

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: TENANT_STATUSES })
  @IsIn(TENANT_STATUSES)
  status!: TenantStatus;
}
