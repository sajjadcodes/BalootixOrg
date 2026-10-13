import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PERMISSION_ACTIONS } from '../permissions.constants.js';
import type { PermissionAction } from '../types/permission.js';

export class CreatePermissionDto {
  @ApiProperty({ example: 'a8c9f6bb-8a34-4ac5-b0dc-6ea58a282f14' })
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiProperty({ enum: PERMISSION_ACTIONS })
  @IsIn(PERMISSION_ACTIONS)
  action!: PermissionAction;
}
