#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8c004bbff5864feb67e254aa6c3079df1e2f8c84a28757cadfe66d774ca7d283/contract';
import startContract from '../../snapshots/8c004bbff5864feb67e254aa6c3079df1e2f8c84a28757cadfe66d774ca7d283/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9f4d301b6de426d53fbc6dc601efaa7cbcbbd4dd6b0552554fbd9b98f66e8db7/contract';
import endContract from '../../snapshots/9f4d301b6de426d53fbc6dc601efaa7cbcbbd4dd6b0552554fbd9b98f66e8db7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'Permission',
        constraint: 'Permission_action_check_e9dee24b',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Permission',
        constraint: 'Permission_action_check_7589694b',
        expression: "\"action\" IN ('READ', 'CREATE', 'UPDATE', 'DELETE')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
