import { PartialType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto.js';

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}
