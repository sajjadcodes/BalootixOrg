import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MOBILE_NUMBER_REGEX } from '../users.constants.js';

export class UpdateUserDto {
  @ApiProperty({ example: 'Alice Johnson', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/\S/, {
    message: 'Display name must contain at least one non-whitespace character',
  })
  displayName?: string;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  @Matches(MOBILE_NUMBER_REGEX, {
    message: 'Mobile must start with + and contain 7 to 15 digits',
  })
  mobile?: string | null;
}
