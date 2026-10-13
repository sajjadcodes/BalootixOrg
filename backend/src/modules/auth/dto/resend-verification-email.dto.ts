import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationEmailDto {
  @ApiProperty({ example: 'sajjad@example.com' })
  @IsEmail()
  email!: string;
}
