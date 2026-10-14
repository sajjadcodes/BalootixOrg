#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2649268b3f921a20e1224b1d6fc54dd4a84610cdc1778719d51803ca20b5c60d/contract';
import startContract from '../../snapshots/2649268b3f921a20e1224b1d6fc54dd4a84610cdc1778719d51803ca20b5c60d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/737ab5da64e363b96f1296ad31d08a1fcee9f4da3d31e1fa36dcd1b33dc729f5/contract';
import endContract from '../../snapshots/737ab5da64e363b96f1296ad31d08a1fcee9f4da3d31e1fa36dcd1b33dc729f5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'Role',
        index: 'Role_tenantId_systemKey_idx_b361b661',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_systemKey_key',
      }),
      this.addUnique({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_tenantId_systemKey_key',
        columns: ['tenantId', 'systemKey'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
