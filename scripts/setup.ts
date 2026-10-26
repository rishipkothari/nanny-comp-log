import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

await sql`CREATE TABLE IF NOT EXISTS days (
  date date PRIMARY KEY,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  stipend numeric(10,2) NOT NULL DEFAULT 0,
  expenses numeric(10,2) NOT NULL DEFAULT 0,
  vacation numeric(6,2) NOT NULL DEFAULT 0,
  sick numeric(6,2) NOT NULL DEFAULT 0,
  holiday boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT ''
)`;
await sql`CREATE TABLE IF NOT EXISTS payments (
  period_start date PRIMARY KEY,
  homepay_earnings numeric(10,2),
  homepay_net numeric(10,2),
  homepay_date date,
  personal_paid numeric(10,2),
  personal_date date,
  route text,
  notes text
)`;
console.log("tables ready");
