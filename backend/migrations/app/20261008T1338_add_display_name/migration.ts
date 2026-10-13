#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/98244a809cc0d0c04f3e2318ea9c6306dae967ab2955c7a4fdcf90712a2280bf/contract';
import endContract from '../../snapshots/98244a809cc0d0c04f3e2318ea9c6306dae967ab2955c7a4fdcf90712a2280bf/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e2228af022e68cdaa4d09b92ce7402db3ff329d588bd42f88c4600fe4eea731c/contract';
import startContract from '../../snapshots/e2228af022e68cdaa4d09b92ce7402db3ff329d588bd42f88c4600fe4eea731c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropColumn({ schema: 'public', table: 'User', column: 'firstName' }),
      this.dropColumn({ schema: 'public', table: 'User', column: 'lastName' }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('displayName', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
