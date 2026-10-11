import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHORIZATION_PERMISSION_KEY,
  type AuthorizationPermissionMetadata,
} from '../decorators/require-permission.decorator.js';
import { AuthorizationService } from '../authorization.service.js';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  // This guard runs before a controller action. Its job is to inspect the route
  // metadata and decide whether the current request should be allowed.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 1: pull the HTTP request and authenticated user from Nest context.
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // Step 2: reject non-authenticated callers before any policy evaluation.
    if (!user || !user.userId) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // Step 3: read authorization metadata attached to the route or controller.
    const permission = this.reflector.get<AuthorizationPermissionMetadata>(
      AUTHORIZATION_PERMISSION_KEY,
      context.getHandler(),
    );

    // Step 4: if no permission metadata is attached, allow the request through.
    if (!permission) {
      return true;
    }

    // Step 5: infer the target organizational unit from common request locations.
    // In practice, this is usually the resource id or target unit id for a move/update.
    const targetUnitId =
      request.params?.unitId ??
      request.params?.id ??
      request.body?.unitId ??
      request.body?.targetUnitId ??
      request.query?.unitId ??
      request.query?.targetUnitId ??
      null;

    // Step 6: delegate the actual business-rule evaluation to the policy service.
    return this.authorizationService.canAccess(
      user.userId,
      permission.action,
      permission.resource,
      targetUnitId,
    );
  }
}
