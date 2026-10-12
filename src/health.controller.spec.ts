import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { HealthController } from './health.controller.js';
import type { PrismaService } from './prisma/prisma.service.js';

describe('HealthController', () => {
  it('serves a liveness check without querying dependencies', () => {
    const checkConnection = jest.fn();
    const controller = new HealthController({ checkConnection } as never);

    expect(controller.liveness()).toEqual({ status: 'ok' });
    expect(checkConnection).not.toHaveBeenCalled();
  });

  it('reports ready when the database query succeeds', async () => {
    const checkConnection = jest.fn(async () => undefined);
    const controller = new HealthController({ checkConnection } as never);

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      database: 'ok',
    });
  });

  it('returns a sanitized unavailable error when the database query fails', async () => {
    const checkConnection = jest.fn(async () => {
      throw new Error('postgres://private-user:password@db/private');
    });
    const controller = new HealthController({ checkConnection } as never);

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.readiness()).rejects.toThrow(
      'Database is unavailable',
    );
  });
});
