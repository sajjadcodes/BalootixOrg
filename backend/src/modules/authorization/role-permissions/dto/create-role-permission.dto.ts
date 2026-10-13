import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRolePermissionDto {
  @ApiProperty({ example: 'd9b7f2d8-696c-4dbf-9fef-9ad495f1bb12' })
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({ example: '4ef5cd7c-17b6-4f8a-b38d-902248c2d0fd' })
  @IsString()
  @IsNotEmpty()
  permissionId!: string;
}
