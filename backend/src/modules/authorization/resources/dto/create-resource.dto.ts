import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({
    example: '/users',
    description: 'The protected route represented by this resource.',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/\S/, { message: 'Route must contain a non-whitespace character' })
  route!: string;
}
