import { defineConfig } from 'drizzle-kit'

/**
 * Postgres, typed schema + migrations (00 Part 8). Evidence is append-only and long-lived;
 * schema drift is unacceptable, so every change is a checked-in, readable SQL migration.
 *
 * `DATABASE_URL` is read here rather than asserted. 00 §3.7: a package validates its own
 * variables at startup and fails LOUDLY if they are missing — a non-null assertion is the
 * opposite of that, it pretends the value is there and fails later somewhere less obvious.
 */
const url = process.env.DATABASE_URL
if (!url) throw new Error('@repo/database: DATABASE_URL is not set — refusing to start.')

export default defineConfig({
  schema: './public/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
})
