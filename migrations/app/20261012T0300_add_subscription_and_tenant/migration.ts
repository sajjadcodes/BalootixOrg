#!/usr/bin/env -S node

import type { Contract as End } from '../../snapshots/199d6d5ce9ff96b61d64583e35dfd5016df2741363eb1ae3761794105b535bc8/contract';
import endContract from '../../snapshots/199d6d5ce9ff96b61d64583e35dfd5016df2741363eb1ae3761794105b535bc8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/391e09f2b78120cef96e1524152aa00c1569fbb0e96f06c124938033368b1698/contract';
import startContract from '../../snapshots/391e09f2b78120cef96e1524152aa00c1569fbb0e96f06c124938033368b1698/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

const { sql: db, raw, contract } = postgres<End>({ contractJson: endContract });
const LEGACY_TENANT_ID = 'legacy-tenant';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_email_idx_46df9cad',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'Permission',
        constraint: 'Permission_resourceId_action_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_unitId_name_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'RoleAssignment',
        constraint: 'RoleAssignment_userId_roleId_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'RolePermission',
        constraint: 'RolePermission_roleId_permissionId_key',
      }),
      this.createTable({
        schema: 'public',
        table: 'Subscription',
        columns: [
          col('cancelAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currentPeriodEnd', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currentPeriodStart', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('plan', 'text', {
            notNull: true,
            default: lit('TRIAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('TRIAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Subscription_plan_check_04a44069',
            "\"plan\" IN ('TRIAL', 'STARTER', 'GROWTH', 'ENTERPRISE')",
          ),
          checkExpression(
            'Subscription_status_check_b176c373',
            "\"status\" IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Tenant',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('slug', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Tenant_status_check_a76535eb',
            "\"status\" IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'ARCHIVED')",
          ),
        ],
      }),
      this.dataTransform(contract, 'seed-legacy-tenant', {
        check: () =>
          raw.sql`
            SELECT 1 AS "needsTenant"
            WHERE NOT EXISTS (
              SELECT 1 FROM "public"."Tenant" WHERE "id" = ${LEGACY_TENANT_ID}
            )
            AND (
              EXISTS (SELECT 1 FROM "public"."EmailVerificationToken") OR
              EXISTS (SELECT 1 FROM "public"."OwnerSetupToken") OR
              EXISTS (SELECT 1 FROM "public"."Permission") OR
              EXISTS (SELECT 1 FROM "public"."Resource") OR
              EXISTS (SELECT 1 FROM "public"."Role") OR
              EXISTS (SELECT 1 FROM "public"."RoleAssignment") OR
              EXISTS (SELECT 1 FROM "public"."RolePermission") OR
              EXISTS (SELECT 1 FROM "public"."Unit") OR
              EXISTS (SELECT 1 FROM "public"."User")
            )
            LIMIT 1
          `.returnsRow({ needsTenant: 'pg/int4@1' }),
        run: () =>
          raw.sql`
            INSERT INTO "public"."Tenant"
              ("id", "slug", "name", "status", "createdAt", "updatedAt")
            VALUES
              (${LEGACY_TENANT_ID}, 'legacy', 'Migrated tenant', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING
          `.affectedCount(),
      }),
      this.addColumn({
        schema: 'public',
        table: 'EmailVerificationToken',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),

      this.dataTransform(contract, 'backfill-EmailVerificationToken-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."EmailVerificationToken"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."EmailVerificationToken"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'EmailVerificationToken',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'OwnerSetupToken',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-OwnerSetupToken-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."OwnerSetupToken"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."OwnerSetupToken"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'OwnerSetupToken',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Permission',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-Permission-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."Permission"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."Permission"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'Permission',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Resource',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-Resource-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."Resource"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."Resource"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'Resource',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Role',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-Role-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."Role"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."Role"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({ schema: 'public', table: 'Role', column: 'tenantId' }),
      this.addColumn({
        schema: 'public',
        table: 'RoleAssignment',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-RoleAssignment-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."RoleAssignment"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."RoleAssignment"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'RoleAssignment',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'RolePermission',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-RolePermission-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."RolePermission"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."RolePermission"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'RolePermission',
        column: 'tenantId',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Unit',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-Unit-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."Unit"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."Unit"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({ schema: 'public', table: 'Unit', column: 'tenantId' }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('tenantId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-User-tenantId', {
        check: () =>
          raw.sql`
            SELECT "id" FROM "public"."User"
            WHERE "tenantId" IS NULL
            LIMIT 1
          `.returnsRow({ id: 'pg/text@1' }),
        run: () =>
          raw.sql`
            UPDATE "public"."User"
            SET "tenantId" = ${LEGACY_TENANT_ID}
            WHERE "tenantId" IS NULL
          `.affectedCount(),
      }),
      this.setNotNull({ schema: 'public', table: 'User', column: 'tenantId' }),
      this.addUnique({
        schema: 'public',
        table: 'EmailVerificationToken',
        constraint: 'EmailVerificationToken_tenantId_tokenHash_key',
        columns: ['tenantId', 'tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OwnerSetupToken',
        constraint: 'OwnerSetupToken_tenantId_tokenHash_key',
        columns: ['tenantId', 'tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Permission',
        constraint: 'Permission_tenantId_resourceId_action_key',
        columns: ['tenantId', 'resourceId', 'action'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Resource',
        constraint: 'Resource_tenantId_route_key',
        columns: ['tenantId', 'route'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Role',
        constraint: 'Role_tenantId_unitId_name_key',
        columns: ['tenantId', 'unitId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RoleAssignment',
        constraint: 'RoleAssignment_tenantId_userId_roleId_key',
        columns: ['tenantId', 'userId', 'roleId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RolePermission',
        constraint: 'RolePermission_tenantId_roleId_permissionId_key',
        columns: ['tenantId', 'roleId', 'permissionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Subscription',
        constraint: 'Subscription_tenantId_key',
        columns: ['tenantId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Tenant',
        constraint: 'Tenant_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Unit',
        constraint: 'Unit_tenantId_parentId_name_key',
        columns: ['tenantId', 'parentId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_tenantId_email_key',
        columns: ['tenantId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerificationToken',
        index: 'EmailVerificationToken_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_tenantId_email_idx_88e149c0',
        columns: ['tenantId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OwnerSetupToken',
        index: 'OwnerSetupToken_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Permission',
        index: 'Permission_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Resource',
        index: 'Resource_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Role',
        index: 'Role_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Role',
        index: 'Role_tenantId_systemKey_idx_b361b661',
        columns: ['tenantId', 'systemKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RoleAssignment',
        index: 'RoleAssignment_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RolePermission',
        index: 'RolePermission_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Unit',
        index: 'Unit_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Subscription',
        foreignKey: {
          name: 'Subscription_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmailVerificationToken',
        foreignKey: {
          name: 'EmailVerificationToken_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OwnerSetupToken',
        foreignKey: {
          name: 'OwnerSetupToken_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Permission',
        foreignKey: {
          name: 'Permission_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Resource',
        foreignKey: {
          name: 'Resource_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Role',
        foreignKey: {
          name: 'Role_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RoleAssignment',
        foreignKey: {
          name: 'RoleAssignment_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RolePermission',
        foreignKey: {
          name: 'RolePermission_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Unit',
        foreignKey: {
          name: 'Unit_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'User',
        foreignKey: {
          name: 'User_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'Tenant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
