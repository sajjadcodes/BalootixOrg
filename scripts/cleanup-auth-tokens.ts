import 'dotenv/config';
import { Pool } from 'pg';

const BATCH_SIZE = 500;
const TOKEN_TABLES = ['EmailVerificationToken', 'OwnerSetupToken'] as const;

// This runs as a one-off job to clean up expired or 
// used auth tokens from the database.
async function deleteTokenBatch(
  pool: Pool,
  table: (typeof TOKEN_TABLES)[number],
): Promise<number> {
  const result = await pool.query(
    `WITH candidates AS (
      SELECT "id"
      FROM "public"."${table}"
      WHERE "expiresAt" < NOW() - INTERVAL '7 days'
         OR "usedAt" < NOW() - INTERVAL '30 days'
      ORDER BY "expiresAt" ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "public"."${table}" AS token
    USING candidates
    WHERE token."id" = candidates."id"
    RETURNING token."id"`,
    [BATCH_SIZE],
  );

  return result.rowCount ?? 0;
}

// This runs as a one-off job to clean up expired or 
// used auth tokens from the database. 
// It connects to the database using the connection string 
// specified in the DATABASE_URL environment variable, 
// and then iterates over the TOKEN_TABLES array, 
// deleting batches of expired or used tokens from each 
// table until there are no more tokens to delete. 
// The script logs the number of deleted tokens 
// for each table and exits with a non-zero status code 
// if an error occurs.
async function cleanupAuthTokens(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });

  try {
    for (const table of TOKEN_TABLES) {
      let deleted = 0;
      let batchDeleted: number;

      do {
        batchDeleted = await deleteTokenBatch(pool, table);
        deleted += batchDeleted;
      } while (batchDeleted === BATCH_SIZE);

      console.info(`${table}: removed ${deleted} retained token rows.`);
    }
  } finally {
    await pool.end();
  }
}

cleanupAuthTokens().catch(() => {
  console.error(
    'Auth token cleanup failed. Check database connectivity and configuration.',
  );
  process.exitCode = 1;
});
