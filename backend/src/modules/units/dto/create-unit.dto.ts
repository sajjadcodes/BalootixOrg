import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UNIT_TYPES } from '../units.constants.js';
import type { UnitType } from '../types/unit.js';

export class CreateUnitDto {
  @ApiProperty({ example: 'Finance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name must contain a non-whitespace character' })
  name!: string;

  @ApiProperty({ enum: UNIT_TYPES })
  @IsIn(UNIT_TYPES)
  type!: UnitType;

  @ApiPropertyOptional({ example: 'Finance division' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'a8c9f6bb-8a34-4ac5-b0dc-6ea58a282f14',
    description: 'Parent unit ID. Omit for a root unit.',
  })
  // Validate parentId only when it is provided; omitted means a root unit.
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  parentId?: string;
}
