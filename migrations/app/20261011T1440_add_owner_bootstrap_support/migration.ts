#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/461eff5efeb32e59ea53ac5ceceba937c359566d894918184dcb218f84a4d2dd/contract';
import endContract from '../../snapshots/461eff5efeb32e59ea53ac5ceceba937c359566d894918184dcb218f84a4d2dd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9f4d301b6de426d53fbc6dc601efaa7cbcbbd4dd6b0552554fbd9b98f66e8db7/contract';
import startContract from '../../snapshots/9f4d301b6de426d53fbc6dc601efaa7cbcbbd4dd6b0552554fbd9b98f66e8db7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

   override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'OwnerSetupToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Role',
        column: col('systemKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'OwnerSetupToken',
        constraint: 'OwnerSetupToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_systemKey_key',
        columns: ['systemKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_email_idx_46df9cad',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
