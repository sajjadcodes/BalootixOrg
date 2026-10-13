#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/98244a809cc0d0c04f3e2318ea9c6306dae967ab2955c7a4fdcf90712a2280bf/contract';
import startContract from '../../snapshots/98244a809cc0d0c04f3e2318ea9c6306dae967ab2955c7a4fdcf90712a2280bf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bfeffc6c7371197bb73ed840d498e2712bef380e7ba7c04f1e8e08b389560e30/contract';
import endContract from '../../snapshots/bfeffc6c7371197bb73ed840d498e2712bef380e7ba7c04f1e8e08b389560e30/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dataTransform(contract, 'handle-nulls-User-displayName', {
        check: () =>
          db.public.User.select('id')
            .where((fields, operators) =>
              operators.eq(fields.displayName, null),
            )
            .limit(1),
        run: () =>
          db.public.User.update({
            displayName: 'Unknown',
            updatedAt: '2026-10-08T13:43:22.704Z',
          }).where((fields, operators) =>
            operators.eq(fields.displayName, null),
          ),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'User',
        column: 'displayName',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
