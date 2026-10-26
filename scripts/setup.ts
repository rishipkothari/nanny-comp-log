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
await sql`CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value numeric NOT NULL
)`;

// Vacation, sick and holiday become hours + minutes. hours/minutes keep meaning "working time".
// The legacy vacation/sick/holiday columns stay and are kept in sync by the app so the
// previous release keeps working until this one is merged.
for (const col of ["vac_h", "vac_m", "sick_h", "sick_m", "hol_h", "hol_m"]) {
  await sql.query(`ALTER TABLE days ADD COLUMN IF NOT EXISTS ${col} integer NOT NULL DEFAULT 0`);
}
await sql`UPDATE days SET vac_h = (round(vacation * 60)::int) / 60, vac_m = (round(vacation * 60)::int) % 60
  WHERE vacation > 0 AND vac_h = 0 AND vac_m = 0`;
await sql`UPDATE days SET sick_h = (round(sick * 60)::int) / 60, sick_m = (round(sick * 60)::int) % 60
  WHERE sick > 0 AND sick_h = 0 AND sick_m = 0`;
await sql`UPDATE days SET hol_h = 8 WHERE holiday AND hol_h = 0 AND hol_m = 0`;

await sql`INSERT INTO settings (key, value) VALUES ('ot_rate', 28), ('ot_threshold', 40) ON CONFLICT (key) DO NOTHING`;

console.log("schema ready");
