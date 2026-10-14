import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SubscriptionPlan } from '../types/platform-admin.js';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  'TRIAL',
  'STARTER',
  'GROWTH',
  'ENTERPRISE',
];

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/)
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  slug!: string;

  @ApiProperty({ example: 'owner@acme.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/\S/)
  ownerDisplayName!: string;

  @ApiPropertyOptional({ enum: SUBSCRIPTION_PLANS, default: 'TRIAL' })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLANS)
  plan?: SubscriptionPlan;
}
