import { jest } from '@jest/globals';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';
import type { UserData } from './types/user.js';

const user: UserData = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  mobile: null,
  isManager: false,
  emailVerifiedAt: null,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};
const req = { user: { tenantId: 'tenant-1' } } as any;

describe('UsersController', () => {
  it('delegates user listing', async () => {
    const listUsers = jest.fn(async () => [user]);
    const controller = new UsersController({
      listUsers,
    } as unknown as UsersService);

    await expect(controller.listUsers(req)).resolves.toEqual([user]);
  });

  it('delegates user lookup', async () => {
    const getUser = jest.fn(async () => user);
    const controller = new UsersController({
      getUser,
    } as unknown as UsersService);

    await expect(controller.getUser(user.id, req)).resolves.toBe(user);
    expect(getUser).toHaveBeenCalledWith(user.id, 'tenant-1');
  });

  it('delegates user updates', async () => {
    const updateUser = jest.fn(async () => user);
    const controller = new UsersController({
      updateUser,
    } as unknown as UsersService);

    await expect(
      controller.updateUser(user.id, { displayName: 'Alice Smith' }, req),
    ).resolves.toBe(user);
    expect(updateUser).toHaveBeenCalledWith(
      user.id,
      {
        displayName: 'Alice Smith',
      },
      'tenant-1',
    );
  });

  it('delegates user deletion', async () => {
    const deleteUser = jest.fn(async () => ({ deleted: true as const }));
    const controller = new UsersController({
      deleteUser,
    } as unknown as UsersService);

    await expect(controller.deleteUser(user.id, req)).resolves.toEqual({
      deleted: true,
    });
    expect(deleteUser).toHaveBeenCalledWith(user.id, 'tenant-1');
  });
});
