import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleAssignmentDto {
  @ApiProperty({ example: 'f5e6ef0f-2b00-435e-9b97-9fe60a4dcb4b' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'd9b7f2d8-696c-4dbf-9fef-9ad495f1bb12' })
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
