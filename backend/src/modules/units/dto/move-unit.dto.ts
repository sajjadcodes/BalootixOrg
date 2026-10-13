import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveUnitDto {
  @ApiPropertyOptional({
    example: 'a8c9f6bb-8a34-4ac5-b0dc-6ea58a282f14',
    description: 'Destination unit ID. Omit to move the unit to the root.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  targetUnitId?: string;
}
