import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants.js';
import type { LoginWithEmailPasswordDto } from './dto/login-with-email-password.dto.js';
import type { RegisterWithEmailPasswordDto } from './dto/register-with-email-password.dto.js';
import type {
  AuthenticatedRequest,
  LoginUserData,
  RegisteredUserData,
} from './types/auth.js';
import type { Response } from 'express';

jest.unstable_mockModule('@nestjs/throttler', () => ({
  ThrottlerGuard: class ThrottlerGuard {},
}));

const { AuthController } = await import('./auth.controller.js');

const createResponse = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

describe('AuthController', () => {
  it('completes owner setup with the provided token and password', async () => {
    const completeSetup = jest.fn(async () => ({ completed: true as const }));
    const controller = new AuthController(
      {} as AuthService,
      { completeSetup } as never,
    );
    const input = { token: 'setup-token', password: 'securePassword123' };

    await expect(controller.completeOwnerSetup(input)).resolves.toEqual({
      completed: true,
    });
    expect(completeSetup).toHaveBeenCalledWith(input);
  });

  it('passes registration input to the service and returns its result', async () => {
    const input: RegisterWithEmailPasswordDto = {
      email: 'person@example.com',
      password: 'password123',
      displayName: 'Person Example',
    };
    const user: RegisteredUserData = {
      id: 'user-1',
      email: input.email,
      displayName: input.displayName,
      isManager: false,
    };
    const registerWithEmailPassword = jest.fn(async () => user);
    const controller = new AuthController(
      {
        registerWithEmailPassword,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );

    await expect(controller.registerWithEmailPassword(input)).resolves.toBe(
      user,
    );
    expect(registerWithEmailPassword).toHaveBeenCalledWith(input);
  });

  it('passes the verification token to the service', async () => {
    const verifyEmail = jest.fn(async () => ({ verified: true as const }));
    const controller = new AuthController(
      {
        verifyEmail,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );

    await expect(
      controller.verifyEmail({ token: 'verification-token' }),
    ).resolves.toEqual({
      verified: true,
    });
    expect(verifyEmail).toHaveBeenCalledWith('verification-token');
  });

  it('returns the currently authenticated user', async () => {
    const user: LoginUserData = {
      id: 'user-1',
      email: 'person@example.com',
      displayName: 'Person Example',
      isManager: false,
      mobile: null,
      avatar: null,
    };
    const getCurrentUser = jest.fn(async () => user);
    const controller = new AuthController(
      {
        getCurrentUser,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );
    const req = {
      user: { userId: 'user-1', email: user.email },
    } as unknown as AuthenticatedRequest;

    await expect(controller.getCurrentUser(req)).resolves.toBe(user);
    expect(getCurrentUser).toHaveBeenCalledWith('user-1');
  });

  it('requests a password reset link for the provided email', async () => {
    const forgotPassword = jest.fn(async () => ({
      message:
        'If an account exists with this email, a reset link has been sent.',
    }));
    const controller = new AuthController(
      {
        forgotPassword,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );

    await expect(
      controller.forgotPassword({ email: 'person@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account exists with this email, a reset link has been sent.',
    });
    expect(forgotPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
    });
  });

  it('resets a password with a valid token', async () => {
    const resetPassword = jest.fn(async () => ({ reset: true as const }));
    const controller = new AuthController(
      {
        resetPassword,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );

    await expect(
      controller.resetPassword({
        token: 'verification-token',
        password: 'newPassword123',
      }),
    ).resolves.toEqual({ reset: true });
    expect(resetPassword).toHaveBeenCalledWith({
      token: 'verification-token',
      password: 'newPassword123',
    });
  });

  it('logs in and sets access and refresh cookies', async () => {
    const input: LoginWithEmailPasswordDto = {
      email: 'person@example.com',
      password: 'password123',
    };
    const user: LoginUserData = {
      id: 'user-1',
      email: input.email,
      displayName: 'Person Example',
      isManager: false,
      mobile: null,
      avatar: null,
    };
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    const loginWithEmailPassword = jest.fn(async () => ({ user, tokens }));
    const controller = new AuthController(
      {
        loginWithEmailPassword,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );
    const res = createResponse();

    await expect(
      controller.loginWithEmailPassword(input, res as unknown as Response),
    ).resolves.toEqual({ user });

    expect(loginWithEmailPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(res.cookie).toHaveBeenNthCalledWith(
      1,
      ACCESS_TOKEN_COOKIE,
      tokens.accessToken,
      expect.objectContaining({ maxAge: ACCESS_TOKEN_MAX_AGE_MS }),
    );
    expect(res.cookie).toHaveBeenNthCalledWith(
      2,
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      expect.objectContaining({
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
        path: '/api/auth',
      }),
    );
  });

  it('refreshes tokens from the refresh cookie and replaces both cookies', async () => {
    const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    const refresh = jest.fn(async () => ({ tokens }));
    const controller = new AuthController(
      {
        refresh,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );
    const req = {
      user: { userId: 'user-1', email: 'person@example.com' },
      cookies: { [REFRESH_TOKEN_COOKIE]: 'old-refresh' },
    } as unknown as AuthenticatedRequest;
    const res = createResponse();

    await expect(
      controller.refresh(req, res as unknown as Response),
    ).resolves.toEqual({ message: 'Tokens refreshed successfully' });

    expect(refresh).toHaveBeenCalledWith('user-1', 'old-refresh');
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      tokens.accessToken,
      expect.objectContaining({ maxAge: ACCESS_TOKEN_MAX_AGE_MS }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      expect.objectContaining({ maxAge: REFRESH_TOKEN_MAX_AGE_MS }),
    );
  });

  it('clears auth cookies and rejects refresh when the cookie is missing', async () => {
    const refresh = jest.fn(async () => ({
      tokens: { accessToken: 'unused', refreshToken: 'unused' },
    }));
    const controller = new AuthController(
      {
        refresh,
      } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );
    const req = {
      user: { userId: 'user-1', email: 'person@example.com' },
      cookies: {},
    } as unknown as AuthenticatedRequest;
    const res = createResponse();

    await expect(
      controller.refresh(req, res as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refresh).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });

  it('revokes the refresh token and clears auth cookies on logout', async () => {
    const logout = jest.fn(async () => undefined);
    const controller = new AuthController(
      { logout } as unknown as AuthService,
      { completeSetup: jest.fn() } as never,
    );
    const req = {
      user: { userId: 'user-1', email: 'person@example.com' },
      cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token' },
    } as unknown as AuthenticatedRequest;
    const res = createResponse();

    await expect(
      controller.logout(req, res as unknown as Response),
    ).resolves.toEqual({ message: 'Logged out successfully' });

    expect(logout).toHaveBeenCalledWith('user-1', 'refresh-token');
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.any(Object),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });
});
