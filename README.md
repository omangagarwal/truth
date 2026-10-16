# SignalCheck

SignalCheck checks claims in posts, articles, and other submitted material against live sources. It separates factual claims from commentary, traces the submitted item's source when evidence allows, and returns a linked report. Users provide their own AI and optional Brave Search API keys.

## Deploy on Vercel

This repository is connected to Vercel. Pushes to the configured production branch (usually `main`) trigger a deployment.

The site is served from `public/index.html`, generated from the shared page in `worker/index.js`. The `/api/*` routes run through a Vercel Node.js Function that adapts the existing request handler and stores rate limits and aggregate usage in PostgreSQL.

Before live checks can run, configure the Vercel project:

1. Connect a PostgreSQL provider from Vercel Marketplace and make its connection string available as `POSTGRES_URL` or `DATABASE_URL`.
2. Add `RATE_LIMIT_HMAC_KEY` as a server-side environment variable. Use a long, random secret; do not expose it with a `NEXT_PUBLIC_` prefix.
3. Redeploy after setting the variables. The function creates the required database tables on first use.

Until the database and HMAC secret are configured, the rate limiter fails closed and analysis requests return an unavailable message. This avoids running checks without the request protection and usage storage used by the current app.

For local builds, run `npm install` and `npm run build`.

## Project layout

- `worker/index.js` — shared UI and claim-checking API logic
- `api/[[...route]].js` — Vercel Node.js adapter and PostgreSQL-backed D1 compatibility layer
- `scripts/build-vercel.mjs` — generates the static homepage
- `drizzle/0000_signalcheck_usage.sql` — original Cloudflare D1 schema
- `drizzle/0001_signalcheck_postgres.sql` — PostgreSQL equivalent
