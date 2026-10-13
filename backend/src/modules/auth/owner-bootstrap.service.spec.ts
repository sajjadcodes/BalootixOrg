import { BadRequestException, ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { EmailService } from './email.service.js';

const hashPassword = jest.fn(async () => 'hashed-password');

jest.unstable_mockModule('bcrypt', () => ({ hash: hashPassword }));

const { OwnerBootstrapService } = await import('./owner-bootstrap.service.js');

type SetupToken = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
};

const setupToken: SetupToken = {
  id: 'setup-token-1',
  tenantId: 'platform-tenant',
  email: 'owner@example.com',
  displayName: 'Org Owner',
  tokenHash: 'stored-token-hash',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  usedAt: null,
};

const rootUnit = {
  id: 'system-unit',
  tenantId: 'platform-tenant',
  parentId: null,
  name: 'System',
  type: 'MANAGEMENT',
  description: 'System unit for platform roles',
  isActive: true,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
};

const createdUser = {
  id: 'owner-user',
  tenantId: 'platform-tenant',
  email: setupToken.email,
  displayName: setupToken.displayName,
};

const createdRole = {
  id: 'owner-role',
  tenantId: 'platform-tenant',
  unitId: rootUnit.id,
  systemKey: 'OWNER',
  name: 'Organization Owner',
};

let currentSetupToken: SetupToken | null = null;
let currentOwnerRole: typeof createdRole | null = null;
let currentUser: typeof createdUser | null = null;
let currentRootUnit: typeof rootUnit | null = null;
let consumedTokenCount = 1;
const platformTenant = { id: 'platform-tenant' };
const tenantFirst = jest.fn(async () => platformTenant);
const tenantOrderBy = jest.fn(() => ({ first: tenantFirst }));

const setupTokenFirst = jest.fn(async () => currentSetupToken);
const setupTokenUpdateAll = jest.fn(async () =>
  consumedTokenCount === 1 ? [{ id: setupToken.id }] : [],
);
const setupTokenQuery = {
  where: jest.fn(() => setupTokenQuery),
  first: setupTokenFirst,
  updateAll: setupTokenUpdateAll,
};
const setupTokenWhere = jest.fn(() => setupTokenQuery);
const setupTokenCreate = jest.fn(
  async (_data: Omit<SetupToken, 'id' | 'usedAt'>) => undefined,
);

const ownerRoleFirst = jest.fn(async () => currentOwnerRole);
const ownerRoleWhere = jest.fn(() => ({ first: ownerRoleFirst }));
const ownerRoleCreate = jest.fn(async () => createdRole);

const userFirst = jest.fn(async () => currentUser);
const userWhere = jest.fn(() => ({ first: userFirst }));
const userCreate = jest.fn(async () => createdUser);

const unitFirst = jest.fn(async () => currentRootUnit);
const unitWhere = jest.fn(() => ({ first: unitFirst }));
const unitCreate = jest.fn(async () => rootUnit);
const roleAssignmentCreate = jest.fn(async () => ({ id: 'assignment-1' }));

const transactionContext = {
  orm: {
    public: {
      OwnerSetupToken: { where: setupTokenWhere },
      Role: { where: ownerRoleWhere, create: ownerRoleCreate },
      User: { where: userWhere, create: userCreate },
      Unit: { where: unitWhere, create: unitCreate },
      RoleAssignment: { create: roleAssignmentCreate },
    },
  },
};

const transaction = jest.fn(
  async (callback: (tx: typeof transactionContext) => Promise<unknown>) =>
    callback(transactionContext),
);

const prismaService = {
  public: {
    Tenant: { orderBy: tenantOrderBy },
    OwnerSetupToken: { create: setupTokenCreate },
    Role: { where: ownerRoleWhere },
    User: { where: userWhere },
  },
  client: { transaction },
};

const sendOwnerSetupEmail = jest.fn(async () => undefined);

describe('OwnerBootstrapService', () => {
  let service: InstanceType<typeof OwnerBootstrapService>;

  beforeEach(() => {
    currentSetupToken = setupToken;
    currentOwnerRole = null;
    currentUser = null;
    currentRootUnit = null;
    consumedTokenCount = 1;
    tenantFirst.mockReset().mockResolvedValue(platformTenant);
    tenantOrderBy.mockClear();
    hashPassword.mockReset().mockResolvedValue('hashed-password');
    setupTokenFirst
      .mockReset()
      .mockImplementation(async () => currentSetupToken);
    setupTokenUpdateAll
      .mockReset()
      .mockImplementation(async () =>
        consumedTokenCount === 1 ? [{ id: setupToken.id }] : [],
      );
    setupTokenWhere.mockClear();
    setupTokenCreate.mockClear();
    ownerRoleFirst.mockReset().mockImplementation(async () => currentOwnerRole);
    ownerRoleWhere.mockClear();
    ownerRoleCreate.mockReset().mockResolvedValue(createdRole);
    userFirst.mockReset().mockImplementation(async () => currentUser);
    userWhere.mockClear();
    userCreate.mockReset().mockResolvedValue(createdUser);
    unitFirst.mockReset().mockImplementation(async () => currentRootUnit);
    unitWhere.mockClear();
    unitCreate.mockReset().mockResolvedValue(rootUnit);
    roleAssignmentCreate.mockReset().mockResolvedValue({ id: 'assignment-1' });
    transaction.mockClear();
    sendOwnerSetupEmail.mockReset().mockResolvedValue(undefined);

    service = new OwnerBootstrapService(
      prismaService as unknown as PrismaService,
      { sendOwnerSetupEmail } as unknown as EmailService,
    );
  });

  it('stores only a hash of a one-time invite token and emails the raw token', async () => {
    await service.issueSetupInvite({
      email: ' OWNER@Example.com ',
      displayName: ' Org Owner ',
    });

    const setupInviteCall = setupTokenCreate.mock.calls[0] as unknown as
      | [
          {
            tenantId: string;
            email: string;
            displayName: string;
            tokenHash: string;
            expiresAt: string;
          },
        ]
      | undefined;
    const emailedCall = sendOwnerSetupEmail.mock.calls[0] as unknown as
      [string, string] | undefined;

    expect(setupInviteCall).toBeDefined();
    expect(emailedCall).toBeDefined();

    const tokenData = setupInviteCall?.[0];
    const emailedToken = emailedCall?.[1];

    if (!tokenData || typeof emailedToken !== 'string') {
      throw new Error('owner setup email token was not recorded');
    }

    expect(tokenData).toEqual(
      expect.objectContaining({
        email: 'owner@example.com',
        displayName: 'Org Owner',
        tenantId: platformTenant.id,
        tokenHash: createHash('sha256').update(emailedToken).digest('hex'),
      }),
    );
    expect(tokenData.tokenHash).not.toBe(emailedToken);
    expect(Date.parse(tokenData.expiresAt)).toBeGreaterThan(Date.now());
    expect(sendOwnerSetupEmail).toHaveBeenCalledWith(
      'owner@example.com',
      expect.any(String),
    );
  });

  it('refuses to issue an invite after an OWNER role exists', async () => {
    currentOwnerRole = createdRole;

    await expect(
      service.issueSetupInvite({
        email: setupToken.email,
        displayName: setupToken.displayName,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(setupTokenCreate).not.toHaveBeenCalled();
    expect(sendOwnerSetupEmail).not.toHaveBeenCalled();
  });

  it('creates the verified user, system role, and assignment atomically', async () => {
    currentSetupToken = {
      ...setupToken,
      tokenHash: createHash('sha256').update('valid-owner-token').digest('hex'),
    };

    await expect(
      service.completeSetup({
        token: 'valid-owner-token',
        password: 'securePassword123',
      }),
    ).resolves.toEqual({ completed: true });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(setupTokenUpdateAll).toHaveBeenCalledWith({
      usedAt: expect.any(String),
    });
    expect(unitCreate).toHaveBeenCalledWith({
      tenantId: platformTenant.id,
      parentId: null,
      name: 'System',
      type: 'MANAGEMENT',
      description: 'System unit for platform roles',
      isActive: true,
    });
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: platformTenant.id,
        email: setupToken.email,
        displayName: setupToken.displayName,
        hashedPassword: 'hashed-password',
        emailVerifiedAt: expect.any(String),
      }),
    );
    expect(ownerRoleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: platformTenant.id,
        systemKey: 'OWNER',
        unitId: rootUnit.id,
      }),
    );
    expect(roleAssignmentCreate).toHaveBeenCalledWith({
      tenantId: platformTenant.id,
      userId: createdUser.id,
      roleId: createdRole.id,
      isActive: true,
    });
  });

  it('rejects an invalid setup token', async () => {
    currentSetupToken = null;

    await expect(
      service.completeSetup({
        token: 'invalid-token',
        password: 'securePassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userCreate).not.toHaveBeenCalled();
    expect(ownerRoleCreate).not.toHaveBeenCalled();
  });

  it('rejects an expired setup token', async () => {
    currentSetupToken = {
      ...setupToken,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };

    await expect(
      service.completeSetup({
        token: 'expired-token',
        password: 'securePassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(setupTokenUpdateAll).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('rejects a token that another request consumed first', async () => {
    consumedTokenCount = 0;

    await expect(
      service.completeSetup({
        token: 'valid-owner-token',
        password: 'securePassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userCreate).not.toHaveBeenCalled();
    expect(ownerRoleCreate).not.toHaveBeenCalled();
  });

  it('rejects setup when an OWNER was provisioned after the invite was sent', async () => {
    currentOwnerRole = createdRole;

    await expect(
      service.completeSetup({
        token: 'valid-owner-token',
        password: 'securePassword123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(setupTokenUpdateAll).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });
});
