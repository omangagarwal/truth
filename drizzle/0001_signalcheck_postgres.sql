CREATE TABLE IF NOT EXISTS request_rate_minute (
  client_hash TEXT NOT NULL,
  minute_bucket BIGINT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (client_hash, minute_bucket)
);
CREATE INDEX IF NOT EXISTS request_rate_minute_expiry ON request_rate_minute (minute_bucket);

CREATE TABLE IF NOT EXISTS request_rate_day (
  day_hash TEXT NOT NULL,
  day_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (day_hash, day_key)
);
CREATE INDEX IF NOT EXISTS request_rate_day_expiry ON request_rate_day (day_key);

CREATE TABLE IF NOT EXISTS usage_daily (
  usage_day TEXT NOT NULL,
  provider TEXT NOT NULL,
  search_provider TEXT NOT NULL,
  depth TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'provider_error')),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  duration_ms_total BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms_total >= 0),
  source_count_total INTEGER NOT NULL DEFAULT 0 CHECK (source_count_total >= 0),
  PRIMARY KEY (usage_day, provider, search_provider, depth, outcome)
);
CREATE INDEX IF NOT EXISTS usage_daily_expiry ON usage_daily (usage_day);
