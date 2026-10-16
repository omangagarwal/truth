import assert from "node:assert/strict";
import { compileD1Sql } from "../api/postgres-sql.js";

assert.equal(
  compileD1Sql("INSERT INTO request_rate_minute (client_hash, minute_bucket) VALUES (?, ?)"),
  "INSERT INTO request_rate_minute (client_hash, minute_bucket) VALUES ($1, $2)",
);
assert.equal(
  compileD1Sql("DELETE FROM usage_daily WHERE usage_day < date('now','-90 days')"),
  "DELETE FROM usage_daily WHERE usage_day < to_char(CURRENT_DATE - INTERVAL '90 days', 'YYYY-MM-DD')",
);
assert.equal(
  compileD1Sql("SELECT * FROM request_rate_day WHERE day_key < date('now','-2 days') AND day_hash = ?"),
  "SELECT * FROM request_rate_day WHERE day_key < to_char(CURRENT_DATE - INTERVAL '2 days', 'YYYY-MM-DD') AND day_hash = $1",
);
console.log("Vercel SQL compatibility checks passed.");
