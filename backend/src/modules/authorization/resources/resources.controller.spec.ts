import { jest } from '@jest/globals';
import type { ResourcesService } from './resources.service.js';
import { ResourcesController } from './resources.controller.js';
import type { ResourceData } from './types/resource.js';

const resource: ResourceData = {
  id: 'resource-1',
  route: '/users',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('ResourcesController', () => {
  it('delegates resource creation', async () => {
    const createResource = jest.fn(async () => resource);
    const controller = new ResourcesController({
      createResource,
    } as unknown as ResourcesService);

    await expect(
      controller.createResource({ route: '/users' }, req),
    ).resolves.toBe(resource);
    expect(createResource).toHaveBeenCalledWith(
      { route: '/users' },
      'tenant-1',
    );
  });

  it('delegates resource listing', async () => {
    const listResources = jest.fn(async () => [resource]);
    const controller = new ResourcesController({
      listResources,
    } as unknown as ResourcesService);

    await expect(controller.listResources(req)).resolves.toEqual([resource]);
  });

  it('delegates resource lookup', async () => {
    const getResource = jest.fn(async () => resource);
    const controller = new ResourcesController({
      getResource,
    } as unknown as ResourcesService);

    await expect(controller.getResource(resource.id, req)).resolves.toBe(
      resource,
    );
    expect(getResource).toHaveBeenCalledWith(resource.id, 'tenant-1');
  });

  it('delegates resource updates', async () => {
    const updateResource = jest.fn(async () => resource);
    const controller = new ResourcesController({
      updateResource,
    } as unknown as ResourcesService);

    await expect(
      controller.updateResource(resource.id, { route: '/members' }, req),
    ).resolves.toBe(resource);
    expect(updateResource).toHaveBeenCalledWith(
      resource.id,
      {
        route: '/members',
      },
      'tenant-1',
    );
  });

  it('delegates resource deletion', async () => {
    const deleteResource = jest.fn(async () => ({ deleted: true as const }));
    const controller = new ResourcesController({
      deleteResource,
    } as unknown as ResourcesService);

    await expect(controller.deleteResource(resource.id, req)).resolves.toEqual({
      deleted: true,
    });
    expect(deleteResource).toHaveBeenCalledWith(resource.id, 'tenant-1');
  });
});
