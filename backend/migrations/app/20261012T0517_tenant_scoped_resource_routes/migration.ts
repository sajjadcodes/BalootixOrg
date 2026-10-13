#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/199d6d5ce9ff96b61d64583e35dfd5016df2741363eb1ae3761794105b535bc8/contract';
import startContract from '../../snapshots/199d6d5ce9ff96b61d64583e35dfd5016df2741363eb1ae3761794105b535bc8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/64dab11946facbfc3887c482453278a790e7fda92b0db641fc8a09c2ec1e1cf5/contract';
import endContract from '../../snapshots/64dab11946facbfc3887c482453278a790e7fda92b0db641fc8a09c2ec1e1cf5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'Resource',
        constraint: 'Resource_route_key',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
