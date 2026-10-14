import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InviteTenantOwnerDto {
  @ApiProperty({ example: 'owner@acme.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/\S/)
  ownerDisplayName!: string;
}
