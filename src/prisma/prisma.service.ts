import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: ReturnType<typeof postgres<Contract>>;

  // This lets us use prisma.public.User for example instead of the longer path.
  get public(): PrismaService['client']['orm']['public'] {
    return this.client.orm.public;
  }

  constructor(configService: ConfigService) {
    this.client = postgres<Contract>({
      contractJson,
      url: configService.getOrThrow<string>('DATABASE_URL'),
    });
  }

  async checkConnection(): Promise<void> {
    await this.public.Tenant.where({ id: '__orgflow_readiness_probe__' })
      .select('id')
      .first();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
