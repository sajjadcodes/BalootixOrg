import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { RegisterWithEmailPasswordDto } from './dto/register-with-email-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { LoginWithEmailPasswordDto } from './dto/login-with-email-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

import { AuthService } from './auth.service.js';
import { REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';

import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../authorization/guards/authorization.guard.js';

import type { Response } from 'express';
import type { AuthenticatedRequest, LoginUserData } from './types/auth.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RequirePermission('/auth/register', 'CREATE')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, AuthorizationGuard)
  registerWithEmailPassword(@Body() input: RegisterWithEmailPasswordDto) {
    return this.authService.registerWithEmailPassword(input);
  }

  @Get('verify-email')
  @UseGuards(ThrottlerGuard)
  verifyEmail(@Query() input: VerifyEmailDto) {
    return this.authService.verifyEmail(input.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.forgotPassword({ email: input.email });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword({
      token: input.token,
      password: input.password,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async loginWithEmailPassword(
    @Body() input: LoginWithEmailPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: LoginUserData }> {
    const result = await this.authService.loginWithEmailPassword({
      email: input.email,
      password: input.password,
    });

    setAuthCookies(res, result.tokens);

    return { user: result.user };
  }

  @Post('refresh')
  @ApiCookieAuth('refresh_token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    // The guard normally rejects a missing or invalid refresh cookie.
    // Keep this check to avoid passing undefined to the service.
    if (!refreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const result = await this.authService.refresh(
      req.user.userId,
      refreshToken,
    );

    // Rotate both cookies after the service validates and rotates tokens.
    setAuthCookies(res, result.tokens);

    return { message: 'Tokens refreshed successfully' };
  }

  @Post('logout')
  @ApiCookieAuth('refresh_token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      await this.authService.logout(req.user.userId, refreshToken);
    }

    clearAuthCookies(res);

    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@Req() req: AuthenticatedRequest): Promise<LoginUserData> {
    return this.authService.getCurrentUser(req.user.userId);
  }
}
