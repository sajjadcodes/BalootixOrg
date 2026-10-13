#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/391e09f2b78120cef96e1524152aa00c1569fbb0e96f06c124938033368b1698/contract';
import endContract from '../../snapshots/391e09f2b78120cef96e1524152aa00c1569fbb0e96f06c124938033368b1698/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/461eff5efeb32e59ea53ac5ceceba937c359566d894918184dcb218f84a4d2dd/contract';
import startContract from '../../snapshots/461eff5efeb32e59ea53ac5ceceba937c359566d894918184dcb218f84a4d2dd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'GlobalAdmin',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hashedPassword', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'GlobalAdmin',
        constraint: 'GlobalAdmin_email_key',
        columns: ['email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
