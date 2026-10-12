import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterWithEmailPasswordDto } from './dto/register-with-email-password.dto.js';
import type { RegisteredUserData } from './types/auth.js';
import { EmailService } from './email.service.js';
import { LoginWithEmailPasswordDto } from './dto/login-with-email-password.dto.js';
import type { LoginUserData } from './types/auth.js';
import { normalizeTenantSlug } from '../platform-admin/tenant-slug.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // REGISTER
  private async ensureDefaultTenant() {
    const existing = await this.prisma.public.Tenant.orderBy((tenant) =>
      tenant.createdAt.asc(),
    ).first();

    if (existing) {
      return existing;
    }

    return this.prisma.public.Tenant.create({
      slug: normalizeTenantSlug(`default-${Date.now()}`),
      name: 'Default Tenant',
      status: 'ACTIVE',
    });
  }

  async registerWithEmailPassword(
    input: RegisterWithEmailPasswordDto,
  ): Promise<RegisteredUserData> {
    const hashedPassword = await bcrypt.hash(input.password, 12);

    const email = input.email.trim().toLowerCase();
    const tenant = await this.ensureDefaultTenant();

    const exists = await this.prisma.public.User.where({
      email,
    }).first();

    if (exists) {
      throw new ConflictException('User with this email already exists');
    }

    const result = await this.prisma.public.User.create({
      tenantId: tenant.id,
      email,
      hashedPassword,
      displayName: input.displayName?.trim(),
      isManager: false,
    });

    // Generate a cryptographically random token for the verification link.
    const token = randomBytes(32).toString('base64url');

    // Store only a hash so the database never contains the usable token.
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Expire the verification link after 30 minutes.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Persist the token hash and its expiry against the new user.
    await this.prisma.public.EmailVerificationToken.create({
      tenantId: tenant.id,
      userId: result.id,
      tokenHash,
      expiresAt,
    });

    // Keep the account recoverable if delivery fails; the resend endpoint can issue another link.
    try {
      await this.emailService.sendVerificationEmail(email, token);
    } catch {
      this.logger.warn('Verification email delivery failed after registration');
      throw new ServiceUnavailableException(
        'Verification email could not be sent. Please retry verification later.',
      );
    }

    // Log registration without including the token or password.
    this.logger.log('User registered successfully');

    return {
      id: result.id,
      email: result.email,
      displayName: result.displayName,
      isManager: result.isManager,
    };
  }

  async resendVerificationEmail(input: { email: string }): Promise<{
    message: string;
  }> {
    const message =
      'If an unverified account exists with this email, a verification link has been sent.';
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.public.User.where({ email })
      .select('id', 'email', 'tenantId', 'emailVerifiedAt')
      .first();

    if (!user || user.emailVerifiedAt !== null) {
      return { message };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await this.prisma.public.EmailVerificationToken.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    try {
      await this.emailService.sendVerificationEmail(email, token);
    } catch {
      this.logger.warn('Verification email resend delivery failed');
    }

    return { message };
  }

  //EMAIL VERIFY
  async verifyEmail(token: string): Promise<{ verified: true }> {
    // Hash the submitted token to compare it with the stored hash.
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Use one timestamp for expiry checks and both database updates.
    const now = new Date().toISOString();

    // Consume the token and verify its account atomically.
    await this.prisma.client.transaction(async (tx) => {
      // Find the token record by its hash, never by the raw token.
      const verification = await tx.orm.public.EmailVerificationToken.where(
        (record) => record.tokenHash.eq(tokenHash),
      ).first();

      // Reject unknown, already-used, or expired tokens.
      if (
        !verification ||
        verification.usedAt !== null ||
        Date.parse(verification.expiresAt) <= Date.now()
      ) {
        throw new BadRequestException(
          'Verification token is invalid or expired',
        );
      }

      // Claim the token only if it is still unused and unexpired.
      const consumed = await tx.orm.public.EmailVerificationToken.where(
        (record) => record.id.eq(verification.id),
      )
        .where((record) => record.usedAt.isNull())
        .where((record) => record.expiresAt.gt(now))
        .updateAll({ usedAt: now });

      // A zero-row update means another request already consumed the token.
      if (consumed.length !== 1) {
        throw new BadRequestException(
          'Verification token is invalid or expired',
        );
      }

      // Mark the user verified only after successfully consuming the token.
      await tx.orm.public.User.where({ id: verification.userId }).updateAll({
        emailVerifiedAt: now,
      });
    });

    // Signal successful verification to the controller.
    return { verified: true };
  }

  // FORGOT PASSWORD
  async forgotPassword(input: { email: string }): Promise<{
    message: string;
  }> {
    const email = input.email.trim().toLowerCase();

    const user = await this.prisma.public.User.where({ email })
      .select('id', 'email', 'tenantId')
      .first();

    if (!user) {
      return {
        message:
          'If an account exists with this email, a reset link has been sent.',
      };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await this.prisma.public.EmailVerificationToken.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    try {
      await this.emailService.sendPasswordResetEmail(email, token);
    } catch {
      this.logger.warn('Password reset email delivery failed');
    }

    return {
      message:
        'If an account exists with this email, a reset link has been sent.',
    };
  }

  // RESET PASSWORD
  async resetPassword(input: {
    token: string;
    password: string;
  }): Promise<{ reset: true }> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const now = new Date().toISOString();

    // Consume the token and reset the password atomically to prevent race conditions.
    await this.prisma.client.transaction(async (tx) => {
      // Find the token record by its hash, never by the raw token.
      const passwordReset = await tx.orm.public.EmailVerificationToken.where(
        (record) => record.tokenHash.eq(tokenHash),
      ).first();

      // Reject unknown, already-used, or expired tokens.
      if (
        !passwordReset ||
        passwordReset.usedAt !== null ||
        Date.parse(passwordReset.expiresAt) <= Date.now()
      ) {
        throw new BadRequestException('Reset token is invalid or expired');
      }

      // Claim the token only if it is still unused and unexpired.
      const consumed = await tx.orm.public.EmailVerificationToken.where(
        (record) => record.id.eq(passwordReset.id),
      )
        .where((record) => record.usedAt.isNull())
        .where((record) => record.expiresAt.gt(now))
        .updateAll({ usedAt: now });

      // A zero-row update means another request already consumed the token.
      if (consumed.length !== 1) {
        throw new BadRequestException('Reset token is invalid or expired');
      }

      // Hash the new password and update the user's record.
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Clear the refresh token hash to log out all sessions after a password reset.
      await tx.orm.public.User.where({ id: passwordReset.userId }).updateAll({
        hashedPassword,
        refreshTokenHash: null,
      });
    });

    return { reset: true };
  }

  //LOGIN
  async loginWithEmailPassword(input: LoginWithEmailPasswordDto): Promise<{
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
    user: LoginUserData;
  }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.public.User.where({
      email,
    }).first();

    if (!user || !(await bcrypt.compare(input.password, user.hashedPassword))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email before logging in',
      );
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tenantId,
    );

    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    this.logger.log('User logged in successfully');

    const userData: LoginUserData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isManager: user.isManager,
      mobile: user.mobile,
      avatar: user.avatarUrl,
    };

    return {
      user: userData,
      tokens,
    };
  }

  // GENERATE TOKENS
  private async generateTokens(
    userId: string,
    email: string,
    tenantId: string,
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, tokenType: 'access' },
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, tokenType: 'refresh' },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  // STORE REFRESH TOKEN HASH
  private async storeRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 12);

    await this.prisma.public.User.where({ id: userId }).update({
      refreshTokenHash: hash,
    });
  }

  // REFRESH TOKEN
  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.public.User.where({ id: userId })
      .select('id', 'email', 'tenantId', 'refreshTokenHash')
      .first();

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tenantId,
    );

    // Rotate the refresh token by storing the new token's hash.
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return { tokens };
  }

  // LOGOUT
  async logout(userId: string, refreshToken: string) {
    const user = await this.prisma.public.User.where({ id: userId })
      .select('refreshTokenHash')
      .first();

    if (!user?.refreshTokenHash) {
      return;
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (isValid) {
      await this.prisma.public.User.where({ id: userId }).update({
        refreshTokenHash: null,
      });
    }
  }

  // GET CURRENT USER
  async getCurrentUser(userId: string): Promise<LoginUserData> {
    const user = await this.prisma.public.User.where({ id: userId })
      .select('id', 'email', 'displayName', 'isManager', 'mobile', 'avatarUrl')
      .first();

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isManager: user.isManager,
      mobile: user.mobile,
      avatar: user.avatarUrl,
    };
  }
}
