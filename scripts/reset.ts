import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

await sql`TRUNCATE days, payments`;
console.log("days and payments wiped (settings kept). Run db:import to reload from import/source.xlsx");
