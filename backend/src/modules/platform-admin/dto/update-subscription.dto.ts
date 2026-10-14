import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types/platform-admin.js';
import { SUBSCRIPTION_PLANS } from './create-tenant.dto.js';

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'INCOMPLETE',
];

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ enum: SUBSCRIPTION_PLANS })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLANS)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: SUBSCRIPTION_STATUSES })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2026-11-14T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  currentPeriodEnd?: string;
}
