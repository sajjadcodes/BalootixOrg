import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user?.email) {
      throw new UnauthorizedException('Authentication context is required');
    }

    const globalAdmin = await this.prisma.public.GlobalAdmin.where({
      email: user.email,
    }).first();

    if (!globalAdmin || !globalAdmin.isActive) {
      throw new ForbiddenException('Platform admin access is required');
    }

    return true;
  }
}
