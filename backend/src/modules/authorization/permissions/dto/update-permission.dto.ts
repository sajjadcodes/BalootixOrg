import { PartialType } from '@nestjs/swagger';
import { CreatePermissionDto } from './create-permission.dto.js';

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
