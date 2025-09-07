import { Pool } from "pg";

const pool = new Pool({
  database: process.env.DATABASE,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: 5432,
  user: process.env.DB_USER,
});

export default {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
};
