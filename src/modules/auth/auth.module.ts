import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailService } from './email.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { OwnerBootstrapService } from './owner-bootstrap.service.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    AuthorizationModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  providers: [
    AuthService,
    OwnerBootstrapService,
    EmailService,
    JwtStrategy,
    RefreshTokenStrategy,
    JwtAuthGuard,
    RefreshTokenGuard,
  ],
  exports: [JwtModule, PassportModule, JwtAuthGuard, OwnerBootstrapService],
  controllers: [AuthController],
})
export class AuthModule {}
