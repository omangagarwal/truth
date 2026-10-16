import postgres from "postgres";
import worker from "../worker/index.js";
import { compileD1Sql } from "./postgres-sql.js";

export const config = { api: { bodyParser: false } };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS request_rate_minute (
    client_hash TEXT NOT NULL,
    minute_bucket BIGINT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (client_hash, minute_bucket)
  )`,
  `CREATE INDEX IF NOT EXISTS request_rate_minute_expiry ON request_rate_minute (minute_bucket)`,
  `CREATE TABLE IF NOT EXISTS request_rate_day (
    day_hash TEXT NOT NULL,
    day_key TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (day_hash, day_key)
  )`,
  `CREATE INDEX IF NOT EXISTS request_rate_day_expiry ON request_rate_day (day_key)`,
  `CREATE TABLE IF NOT EXISTS usage_daily (
    usage_day TEXT NOT NULL,
    provider TEXT NOT NULL,
    search_provider TEXT NOT NULL,
    depth TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'provider_error')),
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    duration_ms_total BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms_total >= 0),
    source_count_total INTEGER NOT NULL DEFAULT 0 CHECK (source_count_total >= 0),
    PRIMARY KEY (usage_day, provider, search_provider, depth, outcome)
  )`,
  `CREATE INDEX IF NOT EXISTS usage_daily_expiry ON usage_daily (usage_day)`,
];

function createDatabase(databaseUrl) {
  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  let schemaReady;

  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = client.begin(async (tx) => {
        for (const statement of schemaStatements) await tx.unsafe(statement);
      }).catch((error) => {
        schemaReady = undefined;
        throw error;
      });
    }
    return schemaReady;
  };

  const execute = async (query, params = [], runner = client) => {
    await ensureSchema();
    return runner.unsafe(compileD1Sql(query), params);
  };

  const db = {
    prepare(query) {
      const statement = { query, params: [] };
      const prepared = {
        bind(...params) {
          statement.params = params;
          return prepared;
        },
        async all() {
          const results = await execute(statement.query, statement.params);
          return { results: Array.from(results) };
        },
        async run() {
          await execute(statement.query, statement.params);
          return { success: true };
        },
      };
      return prepared;
    },
    async batch(statements) {
      await ensureSchema();
      return client.begin(async (tx) => {
        const results = [];
        for (const statement of statements) {
          const rows = await tx.unsafe(compileD1Sql(statement.query), statement.params || []);
          results.push({ results: Array.from(rows) });
        }
        return results;
      });
    },
  };
  return db;
}

let database;
function getEnv() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (url && !database) database = createDatabase(url);
  return {
    DB: url ? database : undefined,
    RATE_LIMIT_HMAC_KEY: process.env.RATE_LIMIT_HMAC_KEY,
  };
}

async function collectBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 17 * 1024 * 1024) throw new Error("Request body exceeds the supported size.");
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function requestHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined && !["connection", "host", "transfer-encoding"].includes(name.toLowerCase())) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
    }
  }
  if (!headers.has("cf-connecting-ip")) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) headers.set("cf-connecting-ip", forwarded);
  }
  return headers;
}

export default async function handler(req, res) {
  try {
    const headers = requestHeaders(req);
    const protocol = headers.get("x-forwarded-proto")?.split(",")[0] || "https";
    const host = headers.get("x-forwarded-host") || req.headers.host || "localhost";
    const url = new URL(req.url || "/", `${protocol}://${host}`);
    const method = (req.method || "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await collectBody(req);
    const request = new Request(url, {
      method,
      headers,
      ...(body?.length ? { body, duplex: "half" } : {}),
    });
    const response = await worker.fetch(request, getEnv());
    res.statusCode = response.status;
    response.headers.forEach((value, name) => {
      if (![
        "connection",
        "transfer-encoding",
        "keep-alive",
        "upgrade",
      ].includes(name.toLowerCase())) res.setHeader(name, value);
    });
    if (!response.body) return res.end();
    for await (const chunk of response.body) {
      if (!res.write(Buffer.from(chunk))) await new Promise((resolve) => res.once("drain", resolve));
    }
    res.end();
  } catch (error) {
    if (res.headersSent) return res.end();
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "The request could not be completed." }));
  }
}
