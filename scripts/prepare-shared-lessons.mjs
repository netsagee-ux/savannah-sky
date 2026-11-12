// Apply this additive migration before the new production routes receive traffic.
import {readFile} from 'node:fs/promises';
import {createClient} from '@libsql/client';

if (process.env.VERCEL_ENV === 'production' && process.env.TURSO_DATABASE_URL) {
  const client = createClient({url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN});
  try {
    const installed = await client.execute("SELECT 1 FROM sqlite_master WHERE type='view' AND name='course_lessons'");
    if (!installed.rows.length) {
      const sql = await readFile(new URL('../drizzle/0007_shared_lessons.sql', import.meta.url), 'utf8');
      await client.batch(sql.split('--> statement-breakpoint').map(statement => statement.trim()).filter(Boolean), 'write');
    }
  } finally {
    client.close();
  }
}
