#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2649268b3f921a20e1224b1d6fc54dd4a84610cdc1778719d51803ca20b5c60d/contract';
import endContract from '../../snapshots/2649268b3f921a20e1224b1d6fc54dd4a84610cdc1778719d51803ca20b5c60d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/64dab11946facbfc3887c482453278a790e7fda92b0db641fc8a09c2ec1e1cf5/contract';
import startContract from '../../snapshots/64dab11946facbfc3887c482453278a790e7fda92b0db641fc8a09c2ec1e1cf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createIndex({
        schema: 'public',
        table: 'EmailVerificationToken',
        index: 'EmailVerificationToken_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerificationToken',
        index: 'EmailVerificationToken_usedAt_idx_31286b90',
        columns: ['usedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_usedAt_idx_31286b90',
        columns: ['usedAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
