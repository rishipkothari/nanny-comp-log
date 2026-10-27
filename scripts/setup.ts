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
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
// Settings used to hold a single number per key; any JSON value fits now (numbers stay numbers).
const valueType = await sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'value'`;
if (valueType[0]?.data_type === "numeric") {
  await sql`ALTER TABLE settings ALTER COLUMN value TYPE jsonb USING to_jsonb(value)`;
}
await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

// Payment approval: a checkbox plus the server time of its last change (an audit trail of the last click).
const hadApproval = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'approved'`;
if (!hadApproval.length) {
  await sql`ALTER TABLE payments ADD COLUMN approved boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE payments ADD COLUMN approved_at timestamptz`;
  // History predates the checkbox: anything with homepay already recorded counts as approved (approved_at stays null = "imported").
  await sql`UPDATE payments SET approved = true WHERE homepay_net IS NOT NULL`;
}

// Calendars are a list with their own lifecycle, so they get tables instead of settings keys.
await sql`CREATE TABLE IF NOT EXISTS calendars (
  id serial PRIMARY KEY,
  label text NOT NULL,
  url text NOT NULL,
  color text NOT NULL DEFAULT '#2f5d9e',
  enabled boolean NOT NULL DEFAULT true,
  last_synced timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS calendar_events (
  id bigserial PRIMARY KEY,
  calendar_id integer NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  uid text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT ''
)`;
// Wall-clock times in the zone each event was created in (the app never shifts them to the viewer's zone).
await sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_local timestamp`;
await sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_local timestamp`;
// Calendars that hold the nanny's schedule feed schedule deduction; deduced days are cached per date.
await sql`ALTER TABLE calendars ADD COLUMN IF NOT EXISTS is_schedule boolean NOT NULL DEFAULT false`;
await sql`CREATE TABLE IF NOT EXISTS schedule_days (
  date date PRIMARY KEY,
  working boolean NOT NULL,
  blocks jsonb NOT NULL,
  total_minutes integer,
  confidence text NOT NULL,
  explanation text NOT NULL DEFAULT '',
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT ''`;
await sql`CREATE INDEX IF NOT EXISTS calendar_events_start ON calendar_events (start_at)`;
await sql`CREATE INDEX IF NOT EXISTS calendar_events_calendar ON calendar_events (calendar_id)`;

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

await sql`INSERT INTO settings (key, value) VALUES ('ot_rate', '28'), ('ot_threshold', '40'), ('venmo_handle', '"anat-sweeney"') ON CONFLICT (key) DO NOTHING`;

console.log("schema ready");
