import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SuccessResponseInterceptor } from './common/interceptors/success-response.interceptor.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { UnitsModule } from './modules/units/units.module.js';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module.js';
import { validateEnvironment } from './config/validate-environment.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    AuthModule,
    AuthorizationModule,
    UsersModule,
    UnitsModule,
    PlatformAdminModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessResponseInterceptor,
    },
  ],
})
export class AppModule {}
