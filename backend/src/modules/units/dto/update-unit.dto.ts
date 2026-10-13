import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { UNIT_TYPES } from '../units.constants.js';
import type { UnitType } from '../types/unit.js';

export class UpdateUnitDto {
  @ApiProperty({ example: 'Finance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name must contain a non-whitespace character' })
  name!: string;

  @ApiProperty({ enum: UNIT_TYPES })
  @IsIn(UNIT_TYPES)
  type!: UnitType;

  @ApiPropertyOptional({ example: 'Finance division', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}
