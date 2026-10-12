import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { UnitsController } from './units.controller.js';
import { UnitsService } from './units.service.js';

@Module({
  imports: [PrismaModule, AuthorizationModule],
  controllers: [UnitsController],
  providers: [UnitsService],
})
export class UnitsModule {}
