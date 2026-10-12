import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import type { RegisterWithEmailPasswordDto } from './dto/register-with-email-password.dto.js';
import type { RegisteredUserData } from './types/auth.js';
import type { EmailService } from './email.service.js';
import type { LoginWithEmailPasswordDto } from './dto/login-with-email-password.dto.js';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';

type VerificationRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

type AuthUserRecord = RegisteredUserData & {
  tenantId: string;
  hashedPassword: string;
  emailVerifiedAt: string | null;
  mobile: string | null;
  avatarUrl: string | null;
  refreshTokenHash: string | null;
};

const createdUser: RegisteredUserData = {
  id: 'user-1',
  email: 'person@example.com',
  displayName: 'Person Example',
  isManager: false,
};
const defaultTenant = { id: 'tenant-1' };

let existingUser: RegisteredUserData | null = null;
let authUser: AuthUserRecord | null = null;
let verificationRecord: VerificationRecord | null = null;
let affectedVerificationRows = 1;
const storedTokens: Array<{
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}> = [];
const sentEmails: Array<{ email: string; token: string }> = [];

const firstUser = jest.fn(async () => authUser ?? existingUser);
const userUpdateAll = jest.fn(async () => [createdUser]);
const userUpdate = jest.fn(async () => [authUser]);
const userQuery = {
  first: firstUser,
  select: jest.fn(() => userQuery),
  updateAll: userUpdateAll,
  update: userUpdate,
};
const userWhere = jest.fn(() => userQuery);
const userCreate = jest.fn(async () => createdUser);
const tokenCreate = jest.fn(async (token: (typeof storedTokens)[number]) => {
  storedTokens.push(token);
  return token;
});
const tenantFirst = jest.fn(async () => defaultTenant);
const tenantOrderBy = jest.fn(() => ({ first: tenantFirst }));
const sendVerificationEmail = jest.fn(async (email: string, token: string) => {
  sentEmails.push({ email, token });
});
const sendPasswordResetEmail = jest.fn(async (email: string, token: string) => {
  sentEmails.push({ email, token });
});
const hashPassword = jest.fn(async () => 'hashed-password');
const comparePassword = jest.fn(async () => true);
const signToken = jest.fn(async (payload: { tokenType: string }) =>
  payload.tokenType === 'access' ? 'access-token' : 'refresh-token',
);
const configService = {
  getOrThrow: jest.fn((key: string) => `${key}-value`),
};
const tokenFirst = jest.fn(async () => verificationRecord);
const tokenUpdateAll = jest.fn(async () =>
  Array.from({ length: affectedVerificationRows }, () => ({ id: 'token-1' })),
);
const tokenQuery = {
  where: jest.fn(() => tokenQuery),
  first: tokenFirst,
  updateAll: tokenUpdateAll,
};
const transactionContext = {
  orm: {
    public: {
      User: { where: userWhere },
      EmailVerificationToken: { where: jest.fn(() => tokenQuery) },
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
    User: { where: userWhere, create: userCreate },
    EmailVerificationToken: { create: tokenCreate },
  },
  client: {
    transaction,
  },
};

jest.unstable_mockModule('bcrypt', () => ({
  hash: hashPassword,
  compare: comparePassword,
}));

jest.unstable_mockModule('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

const { AuthService } = await import('./auth.service.js');

describe('AuthService', () => {
  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    existingUser = null;
    authUser = null;
    verificationRecord = null;
    affectedVerificationRows = 1;
    storedTokens.length = 0;
    sentEmails.length = 0;
    firstUser.mockClear();
    tenantFirst.mockReset().mockResolvedValue(defaultTenant);
    tenantOrderBy.mockClear();
    userWhere.mockClear();
    userCreate.mockClear();
    tokenCreate.mockClear();
    sendVerificationEmail.mockClear();
    sendPasswordResetEmail.mockClear();
    tokenFirst.mockClear();
    tokenUpdateAll.mockClear();
    userUpdateAll.mockClear();
    userUpdate.mockClear();
    userQuery.select.mockClear();
    comparePassword.mockClear();
    comparePassword.mockResolvedValue(true);
    signToken.mockClear();
    configService.getOrThrow.mockClear();
    transaction.mockClear();

    service = new AuthService(
      {
        sendVerificationEmail,
        sendPasswordResetEmail,
      } as unknown as EmailService,
      { signAsync: signToken } as unknown as JwtService,
      configService as unknown as ConfigService,
      prismaService as unknown as PrismaService,
    );
  });

  it('stores a hashed verification token and sends the verification email', async () => {
    const input: RegisterWithEmailPasswordDto = {
      email: ' Person@Example.com ',
      password: 'password123',
      displayName: 'Person Example',
    };

    const result = await service.registerWithEmailPassword(input);
    const sentEmail = sentEmails[0];

    expect(result).toEqual(createdUser);
    expect(userWhere).toHaveBeenCalledWith({ email: 'person@example.com' });
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: defaultTenant.id,
        email: 'person@example.com',
        hashedPassword: 'hashed-password',
      }),
    );
    expect(storedTokens).toHaveLength(1);
    expect(storedTokens[0].tenantId).toBe(defaultTenant.id);
    expect(storedTokens[0].userId).toBe(createdUser.id);
    expect(storedTokens[0].tokenHash).toBe(
      createHash('sha256').update(sentEmail.token).digest('hex'),
    );
    expect(Date.parse(storedTokens[0].expiresAt)).toBeGreaterThan(Date.now());
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'person@example.com',
      sentEmail.token,
    );
  });

  it('does not create a user or send an email when the email exists', async () => {
    existingUser = createdUser;

    await expect(
      service.registerWithEmailPassword({
        email: createdUser.email,
        password: 'password123',
        displayName: createdUser.displayName,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userCreate).not.toHaveBeenCalled();
    expect(tokenCreate).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('keeps registration recoverable and returns 503 when verification delivery fails', async () => {
    sendVerificationEmail.mockRejectedValueOnce(new Error('provider failure'));

    await expect(
      service.registerWithEmailPassword({
        email: createdUser.email,
        password: 'password123',
        displayName: createdUser.displayName,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(userCreate).toHaveBeenCalledTimes(1);
    expect(tokenCreate).toHaveBeenCalledTimes(1);
  });

  it('returns the generic password-reset response when email delivery fails', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };
    sendPasswordResetEmail.mockRejectedValueOnce(new Error('provider failure'));

    await expect(
      service.forgotPassword({ email: createdUser.email }),
    ).resolves.toEqual({
      message:
        'If an account exists with this email, a reset link has been sent.',
    });

    expect(tokenCreate).toHaveBeenCalledTimes(1);
  });

  it('resends verification without disclosing whether the account exists', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: null,
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };
    const genericResponse = {
      message:
        'If an unverified account exists with this email, a verification link has been sent.',
    };

    await expect(
      service.resendVerificationEmail({ email: createdUser.email }),
    ).resolves.toEqual(genericResponse);

    expect(tokenCreate).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

    authUser = null;
    existingUser = null;
    await expect(
      service.resendVerificationEmail({ email: 'unknown@example.com' }),
    ).resolves.toEqual(genericResponse);
    expect(tokenCreate).toHaveBeenCalledTimes(1);
  });

  it('returns the same resend response when verification delivery fails', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: null,
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };
    sendVerificationEmail.mockRejectedValueOnce(new Error('provider failure'));

    await expect(
      service.resendVerificationEmail({ email: createdUser.email }),
    ).resolves.toEqual({
      message:
        'If an unverified account exists with this email, a verification link has been sent.',
    });
  });

  it('sends a password reset link when the user exists', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };

    await expect(
      service.forgotPassword({ email: ' Person@Example.com ' }),
    ).resolves.toEqual({
      message:
        'If an account exists with this email, a reset link has been sent.',
    });

    expect(userWhere).toHaveBeenCalledWith({ email: 'person@example.com' });
    expect(tokenCreate).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sentEmails[0].email).toBe('person@example.com');
  });

  it('resets a password using a valid password-reset token', async () => {
    verificationRecord = {
      id: 'token-1',
      tokenHash: createHash('sha256').update('reset-token').digest('hex'),
      userId: createdUser.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    };

    await expect(
      service.resetPassword({
        token: 'reset-token',
        password: 'newPassword123',
      }),
    ).resolves.toEqual({ reset: true });

    expect(tokenUpdateAll).toHaveBeenCalledWith({
      usedAt: expect.any(String),
    });
    expect(userUpdateAll).toHaveBeenCalledWith({
      hashedPassword: 'hashed-password',
      refreshTokenHash: null,
    });
  });

  it('rejects a password reset when the token is invalid', async () => {
    await expect(
      service.resetPassword({
        token: 'unknown-token',
        password: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tokenUpdateAll).not.toHaveBeenCalled();
    expect(userUpdateAll).not.toHaveBeenCalled();
  });

  it('consumes a valid token and marks its user email verified', async () => {
    const token = 'verification-token';
    verificationRecord = {
      id: 'token-1',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: createdUser.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    };

    await expect(service.verifyEmail(token)).resolves.toEqual({
      verified: true,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tokenFirst).toHaveBeenCalledTimes(1);
    expect(tokenUpdateAll).toHaveBeenCalledWith({
      usedAt: expect.any(String),
    });
    expect(userUpdateAll).toHaveBeenCalledWith({
      emailVerifiedAt: expect.any(String),
    });
  });

  it('rejects a missing verification token', async () => {
    await expect(service.verifyEmail('unknown-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tokenUpdateAll).not.toHaveBeenCalled();
    expect(userUpdateAll).not.toHaveBeenCalled();
  });

  it('rejects an expired verification token', async () => {
    verificationRecord = {
      id: 'token-1',
      tokenHash: 'stored-hash',
      userId: createdUser.id,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      usedAt: null,
    };

    await expect(service.verifyEmail('expired-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tokenUpdateAll).not.toHaveBeenCalled();
    expect(userUpdateAll).not.toHaveBeenCalled();
  });

  it('rejects a token consumed by a concurrent request', async () => {
    verificationRecord = {
      id: 'token-1',
      tokenHash: 'stored-hash',
      userId: createdUser.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      usedAt: null,
    };
    affectedVerificationRows = 0;

    await expect(service.verifyEmail('racing-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(tokenUpdateAll).toHaveBeenCalledTimes(1);
    expect(userUpdateAll).not.toHaveBeenCalled();
  });

  it('authenticates a verified user, issues tokens, and stores the refresh hash', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: '555-0100',
      avatarUrl: 'https://example.com/avatar.png',
      refreshTokenHash: null,
    };
    const input: LoginWithEmailPasswordDto = {
      email: ' Person@Example.com ',
      password: 'password123',
    };

    await expect(service.loginWithEmailPassword(input)).resolves.toEqual({
      user: {
        id: createdUser.id,
        email: createdUser.email,
        displayName: createdUser.displayName,
        isManager: createdUser.isManager,
        mobile: '555-0100',
        avatar: 'https://example.com/avatar.png',
      },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });

    expect(userWhere).toHaveBeenCalledWith({ email: 'person@example.com' });
    expect(comparePassword).toHaveBeenCalledWith(
      input.password,
      'stored-password-hash',
    );
    expect(signToken).toHaveBeenNthCalledWith(
      1,
      {
        sub: createdUser.id,
        email: createdUser.email,
        tenantId: defaultTenant.id,
        tokenType: 'access',
      },
      {
        secret: 'JWT_ACCESS_SECRET-value',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );
    expect(signToken).toHaveBeenNthCalledWith(
      2,
      {
        sub: createdUser.id,
        email: createdUser.email,
        tenantId: defaultTenant.id,
        tokenType: 'refresh',
      },
      {
        secret: 'JWT_REFRESH_SECRET-value',
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    );
    // Access tokens expire after 15 minutes (900 seconds).
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    // Refresh tokens expire after 7 days (604,800 seconds).
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(604_800);
    expect(userUpdate).toHaveBeenCalledWith({
      refreshTokenHash: 'hashed-password',
    });
  });

  it('rejects login when the password is invalid', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };
    comparePassword.mockResolvedValue(false);

    await expect(
      service.loginWithEmailPassword({
        email: createdUser.email,
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signToken).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects login when the user email is not verified', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: null,
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: null,
    };

    await expect(
      service.loginWithEmailPassword({
        email: createdUser.email,
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(signToken).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('returns the current user profile without sensitive fields', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: '555-0100',
      avatarUrl: 'https://example.com/avatar.png',
      refreshTokenHash: 'stored-refresh-hash',
    };

    await expect(service.getCurrentUser(createdUser.id)).resolves.toEqual({
      id: createdUser.id,
      email: createdUser.email,
      displayName: createdUser.displayName,
      isManager: createdUser.isManager,
      mobile: '555-0100',
      avatar: 'https://example.com/avatar.png',
    });

    expect(userWhere).toHaveBeenCalledWith({ id: createdUser.id });
    expect(userQuery.select).toHaveBeenCalledWith(
      'id',
      'email',
      'displayName',
      'isManager',
      'mobile',
      'avatarUrl',
    );
  });

  it('rejects current-user lookup when the user no longer exists', async () => {
    await expect(service.getCurrentUser('deleted-user')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid refresh token and persists the replacement hash', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: 'current-refresh-hash',
    };

    await expect(
      service.refresh(createdUser.id, 'current-refresh-token'),
    ).resolves.toEqual({
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
    });

    expect(comparePassword).toHaveBeenCalledWith(
      'current-refresh-token',
      'current-refresh-hash',
    );
    expect(userQuery.select).toHaveBeenCalledWith(
      'id',
      'email',
      'tenantId',
      'refreshTokenHash',
    );
    expect(userUpdate).toHaveBeenCalledWith({
      refreshTokenHash: 'hashed-password',
    });
  });

  it('rejects an invalid refresh token without rotating it', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: 'current-refresh-hash',
    };
    comparePassword.mockResolvedValue(false);

    await expect(
      service.refresh(createdUser.id, 'invalid-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signToken).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('clears the stored refresh hash on logout only when the token matches', async () => {
    authUser = {
      ...createdUser,
      tenantId: defaultTenant.id,
      hashedPassword: 'stored-password-hash',
      emailVerifiedAt: new Date().toISOString(),
      mobile: null,
      avatarUrl: null,
      refreshTokenHash: 'current-refresh-hash',
    };

    await service.logout(createdUser.id, 'current-refresh-token');

    expect(comparePassword).toHaveBeenCalledWith(
      'current-refresh-token',
      'current-refresh-hash',
    );
    expect(userQuery.select).toHaveBeenCalledWith('refreshTokenHash');
    expect(userUpdate).toHaveBeenCalledWith({ refreshTokenHash: null });

    userUpdate.mockClear();
    comparePassword.mockResolvedValue(false);

    await service.logout(createdUser.id, 'invalid-refresh-token');

    expect(userUpdate).not.toHaveBeenCalled();
  });
});
