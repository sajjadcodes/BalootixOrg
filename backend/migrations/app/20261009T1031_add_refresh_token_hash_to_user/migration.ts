#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1fcdd0d460591cba27a7d71ea30df25598f9fd783b07cb85a69de92911a5e34c/contract';
import startContract from '../../snapshots/1fcdd0d460591cba27a7d71ea30df25598f9fd783b07cb85a69de92911a5e34c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5843644d8c219079df0a3dc8385eaaaada4d663b5b23dbbb405b2750ec3fae63/contract';
import endContract from '../../snapshots/5843644d8c219079df0a3dc8385eaaaada4d663b5b23dbbb405b2750ec3fae63/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('refreshTokenHash', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
