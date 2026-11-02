import { Pool } from "pg";

// Credentials come only from the environment — never hardcoded here.
// See .env.example for the expected variables.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
  );
}

// Reuse a single pool across hot reloads in dev.
const globalForPg = globalThis;

export const pool =
  globalForPg._pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg._pgPool = pool;
}

export async function query(text, params) {
  return pool.query(text, params);
}
