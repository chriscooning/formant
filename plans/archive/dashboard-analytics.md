# Dashboard Analytics — Chart + Big Numbers

> Add analytics above the responses table: time-series chart (views + submissions overlay) with 7/14/30 day range, plus summary cards (completion rate, avg time, total submissions, total views).

---

## Layout (Above Responses Table)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [7 days] [14 days] [30 days]  ← range toggle                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Chart: Views + Submissions                     │   │
│  │         (line chart, two series overlaid)                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ Total    │ │ Total    │ │Completion│ │ Avg      │                   │
│  │ Submits  │ │ Views    │ │ Rate     │ │ Time     │                   │
│  │ 89       │ │ 1,234    │ │ 72%      │ │ 2m 34s   │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
│  Highest dropoff: "What is your email?" — 12 abandoned                  │
│                                                                         │
│  ─── Full submissions | Partial submissions ───                        │
│  [table...]                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend — View Logging + Analytics API

### 1a. View Logging (Daily Aggregate)

**Problem:** `view_count` is a single integer. We need per-day data for the chart.

**Solution:** Add `form_views_daily` table. When a view occurs, upsert today's row.

**File:** `packages/service/src/db/schema.sql` (or migration)

```sql
CREATE TABLE IF NOT EXISTS form_views_daily (
  form_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- 'YYYY-MM-DD'
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (form_id, date),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

CREATE INDEX IF NOT EXISTS idx_form_views_daily_form_date ON form_views_daily(form_id, date);
```

**File:** `packages/service/src/db/queries.ts`

- `incrementViewCount` — keep existing (total on forms table)
- Add `incrementViewCountDaily(db, formId)` — upsert `form_views_daily` for today:
  ```sql
  INSERT INTO form_views_daily (form_id, date, views) VALUES (?, date('now'), 1)
  ON CONFLICT(form_id, date) DO UPDATE SET views = views + 1
  ```
- Call both from the GET /f/:id handler (or combine: increment total + daily in one transaction)

**File:** `packages/service/src/routes/forms.ts`

- In GET /f/:id, also call `incrementViewCountDaily` (fire-and-forget like view_count)

### 1b. Analytics Query

**File:** `packages/service/src/db/queries.ts`

```ts
export async function getAnalytics(
  db: D1Database,
  formId: string,
  days: 7 | 14 | 30
): Promise<{
  totals: { views: number; submissions: number; completionRate: number; avgDurationSeconds: number };
  series: { date: string; views: number; submissions: number }[];
  highestDropoff: { fieldId: string; fieldTitle: string; count: number } | null;
}>
```

- **highestDropoff:** Same range as chart (7/14/30 days). From partials (status = in_progress) within that period, group by `metadata.lastFieldId`. For each fieldId, count how many partials have that as lastFieldId (user abandoned there). Join with schema to get field title. Sort by count DESC, take the single highest. Return `{ fieldId, fieldTitle, count }` or `null` if no partials.

- **Totals:**
  - `views` — from `forms.view_count`
  - `submissions` — count of completed responses (or form.submit_count)
  - `completionRate` — completed / (completed + partials) * 100
  - `avgDurationSeconds` — avg of metadata.duration from completed responses

- **Series:** For each date in the last N days:
  - `views` — from form_views_daily (0 if no row)
  - `submissions` — count of completed responses where date(submitted_at) = that date

**Note:** For existing deployments, `form_views_daily` will be empty until the migration runs. Chart will show 0 views for past days, submissions will still work. Going forward, views accumulate.

### 1c. Analytics Endpoint

**File:** `packages/service/src/routes/responses.ts` (or new `analytics.ts`)

```
GET /api/responses/:formId/analytics?days=7|14|30
  - Auth: Bearer token (same as GET responses)
  - Returns: { totals: {...}, series: [...], highestDropoff: {...} | null }
```

---

## Phase 2: Frontend — Cloudflare Dashboard

### 2a. Chart

- **Library:** Chart.js via CDN (~60KB gzipped)
- **Data:** Fetch from `GET /api/responses/:formId/analytics?days=N`
- **Range toggle:** Buttons "7 days" | "14 days" | "30 days". Active state, refetch on change.
- **Chart type:** Line chart or grouped bar. Two series: Views (e.g. blue), Submissions (e.g. green). Same x-axis (dates).
- **Empty state:** If no data, show "No data for this period" or zeros.

### 2b. Big Numbers (Summary Cards)

Four cards in a row, **order:** Total Submits → Total Views → Completion Rate → Avg Time (or 2x2 on narrow screens):

| Order | Card | Value | Source |
|-------|------|-------|--------|
| 1 | Total Submissions | 89 | `totals.submissions` |
| 2 | Total Views | 1,234 | `totals.views` |
| 3 | Completion Rate | 72% | `totals.completionRate` |
| 4 | Avg Completion Time | 2m 34s | `totals.avgDurationSeconds` → format as Xm Ys |

### 2d. Highest Dropoff

Below the 4 summary cards, add a single line: **"Highest dropoff: [Question title] — X abandoned"**

- **Data:** `highestDropoff` from analytics API — the one question with the most partials (lastFieldId = that field)
- **Display:** One callout, e.g. `Highest dropoff: "What is your email?" — 12 abandoned`
- **Empty state:** If no partials, show "No dropoff data yet"

**Formatting:**
- Duration: if < 60s → "45s"; if < 3600 → "2m 34s"; else "1h 12m"
- Completion rate: one decimal, e.g. "72.3%"
- Numbers: locale string for thousands (1,234)

**Empty states (no completions):**
- Completion rate: show "—"
- Avg completion time: show "—"
- Add note: "No form completions yet"

### 2c. Template Changes

**File:** `.cursor/skills/formant/templates/responses-dashboard.html`

- Add Chart.js script: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>`
- Insert analytics section **above** the tabs (between auth and tabs):
  - Range toggle buttons
  - `<canvas id="analyticsChart">` for the chart
  - Four summary cards in order: Total Submits, Total Views, Completion Rate, Avg Time
  - Highest dropoff: single line showing the one question with most abandons
- On Load: fetch analytics (same auth as responses), render chart + cards
- Analytics loads when API key is present (with or alongside responses load)

---

## Phase 3: Local Admin (In Scope)

**File:** `.cursor/skills/formant/templates/admin-local.html`

Local forms use IndexedDB. We have:
- Submissions (completed + partial) with `submittedAt`, `metadata.duration`
- No view tracking today

**Include in this work:** Partial analytics for local — Total submissions, Completion rate, Avg time, Submissions-over-time chart, Highest dropoff. No views (show "—" for Total Views). Same empty states: "No form completions yet", "No dropoff data yet".

---

## File Summary

| File | Action |
|------|--------|
| `packages/service/src/db/schema.sql` | Add form_views_daily table |
| `packages/service/src/db/migrations/002_form_views_daily.sql` | Migration for existing DBs |
| `packages/service/src/db/queries.ts` | incrementViewCountDaily, getAnalytics |
| `packages/service/src/routes/forms.ts` | Call incrementViewCountDaily on GET /f/:id |
| `packages/service/src/routes/responses.ts` or `analytics.ts` | GET /api/responses/:formId/analytics |
| `.cursor/skills/formant/templates/responses-dashboard.html` | Chart, cards, range toggle |
| `.cursor/skills/formant/templates/admin-local.html` | (Phase 3) Partial analytics, no views |

---

## Verification

1. Deploy form, generate some views (refresh /f/:id) and submissions
2. Open dashboard, verify chart shows both series
3. Toggle 7/14/30 days, verify data updates
4. Verify big numbers match
5. Run migration on existing DB, verify no errors

---

## Open Decisions

1. **Chart library:** Chart.js (recommended) vs lightweight custom SVG
2. **Backfill views:** Existing forms have view_count but no daily history. Chart shows 0 for past. Acceptable for MVP
3. **Local admin scope:** Phase 3 = submissions-only analytics, or defer entirely
