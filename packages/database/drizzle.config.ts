import { defineConfig } from 'drizzle-kit'

/** Postgres, typed schema + migrations (00 Part 8). Evidence is append-only and long-lived;
 *  schema drift is unacceptable, so every change is a checked-in migration. */
export default defineConfig({
  schema: './public/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
