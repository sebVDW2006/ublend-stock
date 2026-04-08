# uBlend Stock — implementation handoff

This is a scaffolded Next.js 15 (App Router) + TypeScript + Tailwind + SQLite
(via `better-sqlite3`) project. Routing, schema, types, and stub UI/API
files are all in place. Your job is to fill in the TODOs.

## What this app does

A stock-take system for uBlend (a smoothie / blended-drinks producer). It lets
the user:

1. **Log production** — record how much of each flavour was made.
2. **Log deliveries** — record drops to client branches (one delivery can
   include multiple flavours, each with its own quantity).
3. **See total stock distributed** — automatic overview broken down by
   branch and flavour.
4. **Do stock checks on site visits** — record what's actually left at a
   branch on a given date.
5. **Track remaining stock** — at-a-glance view per branch with low-stock
   flags driven by `flavours.low_stock_threshold`.
6. **Identify top performers** — sell-through trends month-by-month.

The user is the only operator (for now) and uses it from a phone over LAN.
No auth needed yet; build everything assuming a single trusted user.

## First-run setup

```bash
npm install
npm run db:init   # creates ./data/ublend.db
npm run dev       # serves on 0.0.0.0:3000 (works from phone over LAN)
```

## Architecture

```
src/
├── app/
│   ├── layout.tsx           ← root layout, Nav, fonts/metadata
│   ├── page.tsx             ← Dashboard (stub)
│   ├── globals.css
│   ├── production/page.tsx       (stub)
│   ├── deliveries/page.tsx       (stub)
│   ├── stock-checks/page.tsx     (stub)
│   ├── branches/page.tsx         (stub)
│   ├── flavours/page.tsx         (stub)
│   ├── reports/page.tsx          (stub)
│   └── api/
│       ├── flavours/route.ts     (GET done, POST/PATCH/DELETE TODO)
│       ├── branches/route.ts     (GET done, POST/PATCH/DELETE TODO)
│       ├── production/route.ts   (GET done, POST/DELETE TODO)
│       ├── deliveries/route.ts   (GET partial, POST/DELETE TODO)
│       ├── stock-checks/route.ts (GET partial, POST/DELETE TODO)
│       └── reports/route.ts      (all 4 views TODO)
├── components/
│   └── Nav.tsx
└── lib/
    ├── db.ts          ← getDb() returns a singleton better-sqlite3 connection
    ├── schema.sql     ← all CREATE TABLE statements; idempotent
    └── types.ts       ← Branch, Flavour, Delivery, StockCheck, ...
```

`getDb()` runs `schema.sql` on every boot, so adding a new table just means
editing `schema.sql` and restarting `next dev`.

## Database model (see `src/lib/schema.sql` for the source of truth)

- `branches` — client sites (name, address, contact, active flag)
- `flavours` — products (name, sku, unit, low_stock_threshold, active flag)
- `production_batches` — `(flavour_id, quantity, produced_at, notes)`
- `deliveries` + `delivery_items` — header + line items, one delivery per
  branch visit, multiple flavours per delivery
- `stock_checks` + `stock_check_items` — header + line items, one row per
  flavour counted on a site visit

### Sell-through formula

For consecutive stock checks at the same `(branch, flavour)`:

```
sold = previous_remaining + delivered_between(prev, curr) - current_remaining
```

For the first stock check of a branch+flavour (no previous):

```
sold = delivered_before_or_on(curr) - current_remaining
```

### Estimated remaining (used by the dashboard)

```
if a stock check exists for this branch+flavour:
    estimated_remaining = last_remaining + delivered_since_last_check
else:
    estimated_remaining = total_delivered_to_branch
is_low = estimated_remaining <= flavours.low_stock_threshold
```

## Implementation order (suggested)

1. **`/api/flavours` POST/PATCH/DELETE** + `/flavours` page (CRUD form/list).
   Test by adding 3-4 flavours.
2. **`/api/branches` POST/PATCH/DELETE** + `/branches` page. Add 1-2 branches.
3. **`/api/production` POST/DELETE** + `/production` page. Log a few batches.
4. **`/api/deliveries` POST/DELETE** + `/deliveries` page (the form needs a
   dynamic line-item editor — start with a fixed-row "add row" button). Wrap
   the insert in `db.transaction(...)`.
5. **`/api/stock-checks` POST/DELETE** + `/stock-checks` page. Same
   transaction pattern as deliveries. The form should prefill with every
   active flavour for the chosen branch.
6. **`/api/reports?view=stock`** + Dashboard rendering. This is the
   load-bearing query — get it right before moving on.
7. **`/api/reports?view=top|monthly|distributed`** + Reports page.

## Conventions

- All quantities are integers (no decimals). The unit is stored on the
  flavour (`bottles`, `litres`, `units`, …).
- Dates are ISO strings: `YYYY-MM-DD` for user-facing dates,
  `datetime('now')` for `created_at`.
- API routes return JSON. On error: `{ error: "..." }` with a 4xx/5xx code.
- Forms POST JSON, not multipart. Use Server Actions or fetch from a
  client component — either is fine, pick one and stick with it.
- Tailwind only — no component library. Keep markup simple. Mobile-first;
  the user runs this on a phone.
- No auth, no user accounts.

## Things deliberately NOT in scope

- Cost / pricing / invoicing
- Multiple warehouses or factory sites
- Wastage / write-offs (could be added as a flavour-level adjustment later)
- Authentication / user accounts
- Charts library (use plain HTML/CSS bars in Reports)

If you find yourself wanting any of those, stop and ask the user first.
