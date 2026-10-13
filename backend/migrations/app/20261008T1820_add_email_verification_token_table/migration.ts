#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1fcdd0d460591cba27a7d71ea30df25598f9fd783b07cb85a69de92911a5e34c/contract';
import endContract from '../../snapshots/1fcdd0d460591cba27a7d71ea30df25598f9fd783b07cb85a69de92911a5e34c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bfeffc6c7371197bb73ed840d498e2712bef380e7ba7c04f1e8e08b389560e30/contract';
import startContract from '../../snapshots/bfeffc6c7371197bb73ed840d498e2712bef380e7ba7c04f1e8e08b389560e30/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'EmailVerificationToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tokenHash', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('usedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'EmailVerificationToken',
        constraint: 'EmailVerificationToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerificationToken',
        index: 'EmailVerificationToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmailVerificationToken',
        foreignKey: {
          name: 'EmailVerificationToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
