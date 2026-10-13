import { PartialType } from '@nestjs/swagger';
import { CreateRoleAssignmentDto } from './create-role-assignment.dto.js';

export class UpdateRoleAssignmentDto extends PartialType(
  CreateRoleAssignmentDto,
) {}
