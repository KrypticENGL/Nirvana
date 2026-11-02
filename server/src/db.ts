import pg from "pg";

// Supabase requires SSL; its pooler cert isn't in Node's CA store.
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;
