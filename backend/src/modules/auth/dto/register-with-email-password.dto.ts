import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterWithEmailPasswordDto {
  @ApiProperty({ example: 'sajjad@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\S/, {
    message: 'Password must contain at least one non-whitespace character',
  })
  password!: string;

  @ApiProperty({ example: 'Sajjad Heydari', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'Display name must contain at least one non-whitespace character',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description:
      'Target tenant. Defaults to the caller tenant; only platform admins may target another tenant.',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
