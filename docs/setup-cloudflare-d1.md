# Cloudflare D1 Setup

When Cloudflare deploy fails during D1 database creation, use these steps.

## Manual setup

1. **Enable Workers** (if needed): https://dash.cloudflare.com/?to=/:account/workers/onboarding

2. **Create D1 database**:
   - Dashboard → Workers & Pages → D1 → Create database
   - Name: `formant-db`
   - Copy the database ID (UUID)

3. **Update wrangler.toml**:
   - Edit `packages/service/wrangler.toml`
   - Set `database_id = "your-uuid-here"` in the `[[d1_databases]]` section

4. **Run deploy again**:
   ```bash
   pnpm formant deploy forms/<name>.html --target cloudflare
   ```

## Common errors

- **Not logged in**: Run `cd packages/service && pnpm exec wrangler login`
- **Workers not enabled**: Complete onboarding at the link above
- **Multiple accounts**: Set `CLOUDFLARE_ACCOUNT_ID` if wrangler picks the wrong account
- **"A database with that name already exists"**: The deploy script will automatically look up the ID and patch wrangler.toml. If that fails, run `pnpm exec wrangler d1 list` in packages/service and add the uuid to wrangler.toml manually.
