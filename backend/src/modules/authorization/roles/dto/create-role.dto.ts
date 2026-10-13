import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLE_SCOPES } from '../roles.constants.js';
import type { RoleScope } from '../types/role.js';

export class CreateRoleDto {
  @ApiProperty({ example: 'a8c9f6bb-8a34-4ac5-b0dc-6ea58a282f14' })
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ example: 'Finance Manager' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Approves payment workflows', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: ROLE_SCOPES, default: 'DESCENDANTS' })
  @IsOptional()
  @IsIn(ROLE_SCOPES)
  scope?: RoleScope;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
