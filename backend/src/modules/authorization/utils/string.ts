import { BadRequestException } from '@nestjs/common';

export function normalizeRoute(route: string): string {
  const normalizedRoute = route.trim();

  if (!normalizedRoute) {
    throw new BadRequestException('Route must not be empty');
  }

  return normalizedRoute;
}
