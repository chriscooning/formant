# Vercel + Postgres Setup

Vercel + database requires a one-time setup before form upload works.

## 3-step checklist

1. **Create database:** Vercel Dashboard → your project → Storage → Create Database → Neon (free)
2. **Run migration:** `cd packages/service-vercel && vercel env pull && psql "$POSTGRES_URL" -f src/db/schema.sql`
3. **Run deploy again:** `pnpm formant deploy forms/<name>.html --target vercel --with-backend`

## Links

- [Vercel Storage](https://vercel.com/dashboard/stores) — create and manage databases
