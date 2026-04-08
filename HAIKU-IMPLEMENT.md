# HAIKU: Migrate uBlend Stock to Turso + PWA

You are Haiku. Your job is to migrate this Next.js app from local SQLite (`better-sqlite3`) to hosted SQLite (`@libsql/client` / Turso), then make it installable as a PWA. **Read this entire document before starting.**

---

## Why we're doing this

The app is currently deployed to Vercel but **broken in production** because Vercel is serverless — there's no persistent filesystem, so `better-sqlite3`'s `data/ublend.db` file disappears between requests. Every "Create" button errors out.

The fix: swap the database layer for Turso (hosted libSQL, free tier). Then add PWA manifest + service worker so the user can install the app on their phone and laptop home screen.

**Critical constraint:** The user wants the app to remain "versatile" — they want to keep editing UI / pages / styles freely afterward without redoing this work. So this migration must:

- Touch ONLY `src/lib/db.ts`, the 6 files in `src/app/api/*/route.ts`, `src/app/layout.tsx`, and `package.json`.
- NOT touch any page component (`src/app/*/page.tsx`).
- NOT change any API request/response shapes — pages must keep working unchanged.
- Keep `src/lib/schema.sql` as the source of truth.

---

## What you must NOT do

- Do not "improve" or refactor any page component.
- Do not change Tailwind, layout, navigation, or styling.
- Do not add new features. This is a migration, not a redesign.
- Do not change the API route URLs or response shapes.
- Do not delete `data/ublend.db` or `scripts/init-db.mjs` (they remain useful for local dev).
- Do not commit secrets (`TURSO_AUTH_TOKEN`) to git.

---

## Prerequisites the user has already done

- GitHub repo `sebVDW2006/ublend-stock` exists, connected to Vercel for auto-deploy.
- Vercel project already deployed (currently broken — that's what we're fixing).
- Local dev environment works with `npm run dev` after `brew install node`.
- User has GitHub Desktop installed for non-CLI git workflow.

---

## High-level plan (7 phases)

| Phase | What | Who does it |
|---|---|---|
| 1 | Create Turso database | User (you give exact instructions) |
| 2 | Swap database dependency | You (`package.json`) |
| 3 | Rewrite `src/lib/db.ts` | You |
| 4 | Update 6 API route handlers | You |
| 5 | Add PWA files (`manifest.json`, `sw.js`, icons, `layout.tsx`) | You |
| 6 | Set Vercel env vars | User (you give exact instructions) |
| 7 | Push + verify | User pushes via GitHub Desktop, you verify |

---

## PHASE 1 — Create the Turso database (USER STEPS)

Write these instructions in your final reply to the user. Don't run any of this yourself.

```
1. Go to https://turso.tech and click "Sign up". Sign in with GitHub.
2. Once in the dashboard, click "Create Database".
   - Name: ublend-stock
   - Location: pick the closest one to you (e.g. "London (lhr)" if you're in the UK)
   - Plan: Starter (free)
3. Click the new database. You'll see a "Connect" or "Connection" tab.
4. Copy two values:
     - Database URL  (starts with libsql://)
     - Auth Token    (long random string — click "Generate Token", set expiration to "Never")
5. Keep this tab open — you'll paste them into Vercel in Phase 6.
6. In the same dashboard, click "SQL Console" (or "Query" / "Shell") for the database.
7. Open the file src/lib/schema.sql in your project (in VS Code or Finder).
   Copy the ENTIRE contents and paste into the SQL Console. Click "Run".
   You should see "OK" or no errors. The tables are now created in Turso.
```

---

## PHASE 2 — Swap the dependency

Edit `package.json`. Replace the `dependencies` block with:

```json
"dependencies": {
  "@libsql/client": "^0.14.0",
  "next": "^15.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0"
}
```

(Remove `better-sqlite3`. Keep everything else.)

Also remove `@types/better-sqlite3` from `devDependencies`.

Then tell the user (in your final reply) to run, in their terminal:

```
cd /Users/sebvdw/Documents/Code/ublend-stock
npm install
```

This will fetch `@libsql/client` and remove `better-sqlite3`.

---

## PHASE 3 — Rewrite `src/lib/db.ts`

Replace the entire file with:

```typescript
import { createClient, type Client } from "@libsql/client";

// Single shared libSQL client. Safe to reuse across requests in serverless
// environments — the underlying HTTP connection is pooled.
//
// Why this changed: better-sqlite3 needs a writable file on disk, which
// Vercel serverless functions do not have. libSQL talks to a remote
// Turso database over HTTP, so it works in any serverless environment.
//
// The schema in src/lib/schema.sql must be applied to the Turso database
// ONCE manually via the Turso web shell — see HAIKU-IMPLEMENT.md Phase 1.

let _db: Client | null = null;

export function getDb(): Client {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. See HAIKU-IMPLEMENT.md Phase 6."
    );
  }

  _db = createClient({ url, authToken });
  return _db;
}
```

**Key differences from the old `db.ts`:**

- Returns a `Client`, not `Database.Database`.
- Does NOT read `schema.sql` at runtime — schema is applied once via Turso web shell (Phase 1).
- Does NOT use `pragma()` — Turso/libSQL doesn't expose these the same way; the schema file already includes `PRAGMA foreign_keys = ON`.
- Stays synchronous (creating the client is sync; only `.execute()` calls are async).

---

## PHASE 4 — Update the 6 API route handlers

The libSQL API is async and slightly different. **The translation is mechanical** — apply the same pattern to every route.

### Translation table

| `better-sqlite3` (old) | `@libsql/client` (new) |
|---|---|
| `db.prepare("SELECT ... WHERE id = ?").all(id)` | `(await db.execute({ sql: "SELECT ... WHERE id = ?", args: [id] })).rows` |
| `db.prepare("SELECT ... WHERE id = ?").get(id)` | `(await db.execute({ sql: "SELECT ... WHERE id = ?", args: [id] })).rows[0]` |
| `db.prepare("INSERT ...").run(a, b)` | `await db.execute({ sql: "INSERT ...", args: [a, b] })` |
| `result.lastInsertRowid` | `Number(result.lastInsertRowid)` (it's a bigint) |
| `db.transaction(() => { ... })()` | `const tx = await db.transaction("write"); try { ... await tx.commit(); } catch (e) { await tx.rollback(); throw e; }` |

### Important gotchas

1. **All handlers must be `async`** (most already are). The `GET` handler in some files isn't — make it `async`.
2. **`.rows` items are plain objects** — column access works the same as `better-sqlite3` (`row.name`, `row.id`, etc.).
3. **Bigint conversion**: `lastInsertRowid` is a `bigint`. Convert to `Number()` before passing as a query arg or returning as JSON (JSON can't serialize bigint).
4. **`null` vs `undefined`**: libSQL needs explicit `null` for optional args (the old code already does `notes || null`, so this is fine).
5. **Transactions** must call `.commit()` or `.rollback()` explicitly. Don't forget the try/catch.
6. **Inside a transaction**, use `tx.execute(...)` not `db.execute(...)`.

### File-by-file changes

Below are the EXACT files to edit. Do them in order. After each one, the file should compile cleanly.

---

#### 4a. `src/app/api/flavours/route.ts`

Replace the entire file with:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/flavours          → list all flavours
// POST   /api/flavours          → create { name, sku?, unit?, low_stock_threshold?, notes? }
// PATCH  /api/flavours?id=N     → update any subset of fields
// DELETE /api/flavours?id=N     → soft-delete (set active=0)

export async function GET() {
  const db = getDb();
  const result = await db.execute(
    "SELECT * FROM flavours ORDER BY active DESC, name ASC"
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { name, sku, unit = "units", low_stock_threshold = 10, notes } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const insertResult = await db.execute({
      sql: `INSERT INTO flavours (name, sku, unit, low_stock_threshold, notes)
            VALUES (?, ?, ?, ?, ?)`,
      args: [name.trim(), sku || null, unit || "units", low_stock_threshold, notes || null],
    });

    const id = Number(insertResult.lastInsertRowid);
    const row = (await db.execute({
      sql: "SELECT * FROM flavours WHERE id = ?",
      args: [id],
    })).rows[0];

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create flavour" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const body = await req.json();
    const { name, sku, unit, low_stock_threshold, notes, active } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (sku !== undefined) { updates.push("sku = ?"); values.push(sku); }
    if (unit !== undefined) { updates.push("unit = ?"); values.push(unit); }
    if (low_stock_threshold !== undefined) { updates.push("low_stock_threshold = ?"); values.push(low_stock_threshold); }
    if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }
    if (active !== undefined) { updates.push("active = ?"); values.push(active ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }

    values.push(id);
    await db.execute({
      sql: `UPDATE flavours SET ${updates.join(", ")} WHERE id = ?`,
      args: values,
    });

    const row = (await db.execute({
      sql: "SELECT * FROM flavours WHERE id = ?",
      args: [id],
    })).rows[0];
    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update flavour" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.execute({
      sql: "UPDATE flavours SET active = 0 WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete flavour" }, { status: 500 });
  }
}
```

---

#### 4b. `src/app/api/branches/route.ts`

Apply the SAME pattern. Verbatim translation of every `db.prepare(...).all/get/run` call. Fields are different (`name, address, contact_name, contact_phone, notes, active`), table is `branches`. Same insert+select pattern using `lastInsertRowid`.

---

#### 4c. `src/app/api/production/route.ts`

The current file uses `(SELECT last_insert_rowid())` in the post-insert SELECT. Replace that with the `Number(insertResult.lastInsertRowid)` pattern, then the SELECT becomes `WHERE pb.id = ?` with the captured id.

Replace with:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const result = await db.execute(
    `SELECT pb.*, f.name AS flavour_name, f.unit
       FROM production_batches pb
       JOIN flavours f ON f.id = pb.flavour_id
       ORDER BY pb.produced_at DESC, pb.id DESC`
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { flavour_id, quantity, produced_at, notes } = body;

    if (!flavour_id || !quantity) {
      return NextResponse.json({ error: "flavour_id and quantity are required" }, { status: 400 });
    }

    const insertResult = await db.execute({
      sql: `INSERT INTO production_batches (flavour_id, quantity, produced_at, notes)
            VALUES (?, ?, ?, ?)`,
      args: [
        flavour_id,
        quantity,
        produced_at || new Date().toISOString().split("T")[0],
        notes || null,
      ],
    });

    const id = Number(insertResult.lastInsertRowid);
    const row = (await db.execute({
      sql: `SELECT pb.*, f.name AS flavour_name, f.unit
              FROM production_batches pb
              JOIN flavours f ON f.id = pb.flavour_id
             WHERE pb.id = ?`,
      args: [id],
    })).rows[0];

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.execute({
      sql: "DELETE FROM production_batches WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}
```

---

#### 4d. `src/app/api/deliveries/route.ts`

This one has a transaction. Use the libSQL transaction pattern. Replace with:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const deliveriesResult = await db.execute(
    `SELECT d.*, b.name AS branch_name
       FROM deliveries d
       JOIN branches b ON b.id = d.branch_id
       ORDER BY d.delivered_at DESC, d.id DESC`
  );

  // Fetch items for each delivery (sequential — small N, fine for now)
  const result = [];
  for (const d of deliveriesResult.rows) {
    const itemsResult = await db.execute({
      sql: `SELECT di.flavour_id, f.name as flavour_name, f.unit, di.quantity
              FROM delivery_items di
              JOIN flavours f ON f.id = di.flavour_id
             WHERE di.delivery_id = ?`,
      args: [d.id as number],
    });
    result.push({ ...d, items: itemsResult.rows });
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { branch_id, delivered_at, notes, items } = body;

    if (!branch_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "branch_id and items array required" },
        { status: 400 }
      );
    }

    const tx = await db.transaction("write");
    try {
      const deliveryResult = await tx.execute({
        sql: `INSERT INTO deliveries (branch_id, delivered_at, notes)
              VALUES (?, ?, ?)`,
        args: [
          branch_id,
          delivered_at || new Date().toISOString().split("T")[0],
          notes || null,
        ],
      });
      const deliveryId = Number(deliveryResult.lastInsertRowid);

      for (const item of items) {
        await tx.execute({
          sql: `INSERT INTO delivery_items (delivery_id, flavour_id, quantity)
                VALUES (?, ?, ?)`,
          args: [deliveryId, item.flavour_id, item.quantity],
        });
      }

      await tx.commit();
      return NextResponse.json({ id: deliveryId }, { status: 201 });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create delivery" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.execute({
      sql: "DELETE FROM deliveries WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete delivery" }, { status: 500 });
  }
}
```

---

#### 4e. `src/app/api/stock-checks/route.ts`

Same pattern as deliveries. Replace with:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branch_id");

  const checksResult = branchId
    ? await db.execute({
        sql: `SELECT * FROM stock_checks WHERE branch_id = ? ORDER BY checked_at DESC, id DESC`,
        args: [branchId],
      })
    : await db.execute(
        `SELECT * FROM stock_checks ORDER BY checked_at DESC, id DESC`
      );

  const result = [];
  for (const check of checksResult.rows) {
    const itemsResult = await db.execute({
      sql: `SELECT sci.flavour_id, f.name as flavour_name, f.unit, sci.quantity_remaining
              FROM stock_check_items sci
              JOIN flavours f ON f.id = sci.flavour_id
             WHERE sci.stock_check_id = ?`,
      args: [check.id as number],
    });
    result.push({ ...check, items: itemsResult.rows });
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { branch_id, checked_at, notes, items } = body;

    if (!branch_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "branch_id and items array required" },
        { status: 400 }
      );
    }

    const tx = await db.transaction("write");
    try {
      const checkResult = await tx.execute({
        sql: `INSERT INTO stock_checks (branch_id, checked_at, notes)
              VALUES (?, ?, ?)`,
        args: [
          branch_id,
          checked_at || new Date().toISOString().split("T")[0],
          notes || null,
        ],
      });
      const checkId = Number(checkResult.lastInsertRowid);

      for (const item of items) {
        await tx.execute({
          sql: `INSERT INTO stock_check_items (stock_check_id, flavour_id, quantity_remaining)
                VALUES (?, ?, ?)`,
          args: [checkId, item.flavour_id, item.quantity_remaining],
        });
      }

      await tx.commit();
      return NextResponse.json({ id: checkId }, { status: 201 });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create stock check" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const db = getDb();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.execute({
      sql: "DELETE FROM stock_checks WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete stock check" }, { status: 500 });
  }
}
```

---

#### 4f. `src/app/api/reports/route.ts`

This is the trickiest because it has 4 views and the `stock` view does an inner loop with a per-item query. The translation is still mechanical. Replace with:

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "stock";
  const period = parseInt(url.searchParams.get("period") ?? "90");

  switch (view) {
    case "stock": {
      const deliveriesResult = await db.execute(
        `SELECT b.id as branch_id, b.name as branch_name,
                f.id as flavour_id, f.name as flavour_name, f.unit,
                f.low_stock_threshold,
                COALESCE(SUM(di.quantity), 0) as delivered_total
           FROM branches b
           CROSS JOIN flavours f
           LEFT JOIN deliveries d ON d.branch_id = b.id
           LEFT JOIN delivery_items di ON di.delivery_id = d.id AND di.flavour_id = f.id
          WHERE b.active = 1 AND f.active = 1
          GROUP BY b.id, f.id`
      );

      const lastChecksResult = await db.execute(
        `SELECT branch_id, flavour_id, checked_at, quantity_remaining
           FROM (
             SELECT sc.branch_id, sci.flavour_id, sc.checked_at, sci.quantity_remaining,
                    ROW_NUMBER() OVER (PARTITION BY sc.branch_id, sci.flavour_id ORDER BY sc.checked_at DESC) as rn
               FROM stock_checks sc
               JOIN stock_check_items sci ON sci.stock_check_id = sc.id
           )
          WHERE rn = 1`
      );

      const lastCheckMap = new Map<string, any>();
      lastChecksResult.rows.forEach((lc: any) => {
        lastCheckMap.set(`${lc.branch_id}-${lc.flavour_id}`, lc);
      });

      const result = [];
      for (const d of deliveriesResult.rows as any[]) {
        const lastCheck = lastCheckMap.get(`${d.branch_id}-${d.flavour_id}`);
        let estimated_remaining = d.delivered_total;
        let last_check_remaining = null;
        let last_checked_at = null;

        if (lastCheck) {
          last_check_remaining = lastCheck.quantity_remaining;
          last_checked_at = lastCheck.checked_at;

          const sinceResult = await db.execute({
            sql: `SELECT COALESCE(SUM(di.quantity), 0) as qty
                    FROM deliveries d
                    JOIN delivery_items di ON di.delivery_id = d.id
                   WHERE d.branch_id = ? AND di.flavour_id = ? AND d.delivered_at > ?`,
            args: [d.branch_id, d.flavour_id, lastCheck.checked_at],
          });
          const qty = (sinceResult.rows[0] as any)?.qty || 0;
          estimated_remaining = Number(last_check_remaining) + Number(qty);
        }

        result.push({
          branch_id: d.branch_id,
          branch_name: d.branch_name,
          flavour_id: d.flavour_id,
          flavour_name: d.flavour_name,
          unit: d.unit,
          delivered_total: d.delivered_total,
          last_check_remaining,
          last_checked_at,
          estimated_remaining,
          is_low: estimated_remaining <= d.low_stock_threshold,
        });
      }

      return NextResponse.json(result);
    }

    case "top": {
      const result = await db.execute({
        sql: `SELECT f.id, f.name,
                     COALESCE(SUM(CASE
                       WHEN d.delivered_at >= datetime('now', '-' || ? || ' days')
                       THEN di.quantity
                     END), 0) as delivered_recent,
                     COALESCE((SELECT sci.quantity_remaining
                       FROM stock_checks sc
                       JOIN stock_check_items sci ON sci.stock_check_id = sc.id
                       WHERE sci.flavour_id = f.id
                       ORDER BY sc.checked_at DESC
                       LIMIT 1), 0) as last_remaining
                FROM flavours f
                LEFT JOIN delivery_items di ON di.flavour_id = f.id
                LEFT JOIN deliveries d ON d.id = di.delivery_id
               WHERE f.active = 1
               GROUP BY f.id, f.name
               ORDER BY delivered_recent DESC
               LIMIT 10`,
        args: [period],
      });

      const out = result.rows.map((r: any) => ({
        flavour_id: r.id,
        flavour_name: r.name,
        delivered: r.delivered_recent,
        sold: Number(r.delivered_recent) - Number(r.last_remaining),
      }));

      return NextResponse.json(out);
    }

    case "monthly": {
      const result = await db.execute(
        `SELECT f.id, f.name,
                strftime('%Y-%m', d.delivered_at) as month,
                COALESCE(SUM(di.quantity), 0) as delivered
           FROM flavours f
           LEFT JOIN delivery_items di ON di.flavour_id = f.id
           LEFT JOIN deliveries d ON d.id = di.delivery_id
          WHERE f.active = 1 AND d.delivered_at IS NOT NULL
          GROUP BY f.id, month
          ORDER BY month DESC, f.name ASC`
      );

      const out = result.rows.map((r: any) => ({
        flavour_id: r.id,
        flavour_name: r.name,
        period: r.month,
        delivered: r.delivered,
        sold: 0,
      }));

      return NextResponse.json(out);
    }

    case "distributed": {
      const result = await db.execute(
        `SELECT b.id as branch_id, b.name as branch_name,
                f.id as flavour_id, f.name as flavour_name, f.unit,
                COALESCE(SUM(di.quantity), 0) as total_delivered
           FROM branches b
           CROSS JOIN flavours f
           LEFT JOIN deliveries d ON d.branch_id = b.id
           LEFT JOIN delivery_items di ON di.delivery_id = d.id AND di.flavour_id = f.id
          WHERE b.active = 1 AND f.active = 1
          GROUP BY b.id, f.id
          ORDER BY b.name, f.name`
      );
      return NextResponse.json(result.rows);
    }

    default:
      return NextResponse.json({ error: "unknown view" }, { status: 400 });
  }
}
```

---

## PHASE 5 — PWA setup

### 5a. Create the public folder

The project doesn't have a `public/` folder yet. Create:

```
public/
  manifest.json
  sw.js
  icons/
    icon-192.png   ← user must provide (instructions below)
    icon-512.png   ← user must provide (instructions below)
```

### 5b. `public/manifest.json`

Create with this content:

```json
{
  "name": "uBlend Stock",
  "short_name": "uBlend",
  "description": "Stock take, production and delivery tracking for uBlend",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7c3aed",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 5c. `public/sw.js` (service worker)

Create with this content. This is a minimal "network-first, cache fallback" service worker — enough to make the app installable and survive brief offline blips, but it does NOT cache API responses (the user always wants fresh stock data).

```javascript
const CACHE_NAME = "ublend-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests — stock data must always be fresh.
  if (url.pathname.startsWith("/api/")) {
    return; // let the browser handle it normally
  }

  // Network-first for everything else, fall back to cache if offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
```

### 5d. Update `src/app/layout.tsx`

Two changes: add `manifest` to metadata, and register the service worker via a small client component.

Replace the entire file with:

```typescript
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "uBlend Stock",
  description: "Stock take, production and delivery tracking for uBlend",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "uBlend Stock",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegister />
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

### 5e. Create `src/components/ServiceWorkerRegister.tsx`

A tiny client component that registers the service worker on mount. (Service worker registration MUST happen client-side, so it lives in its own component to keep `layout.tsx` server-rendered.)

```typescript
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
```

### 5f. Icon files

The user must provide two PNG icons. In your final reply to the user, give them this:

```
PWA icons — pick ONE of these options:

OPTION A (easiest, 2 minutes):
  1. Go to https://favicon.io/favicon-generator/
  2. Text: "uB"
  3. Background: Rounded
  4. Background color: #7c3aed
  5. Font color: #ffffff
  6. Font size: 110
  7. Click "Download"
  8. From the zip, copy android-chrome-192x192.png  → save as public/icons/icon-192.png
  9. Copy android-chrome-512x512.png                → save as public/icons/icon-512.png

OPTION B (use your own logo):
  Save your logo as a square PNG in two sizes (192×192 and 512×512) at:
    public/icons/icon-192.png
    public/icons/icon-512.png
```

---

## PHASE 6 — Set Vercel environment variables (USER STEPS)

In your final reply to the user, write:

```
1. Go to https://vercel.com/dashboard
2. Click your "ublend-stock" project
3. Click "Settings" (top tab) → "Environment Variables" (left sidebar)
4. Add the first variable:
     Name:  TURSO_DATABASE_URL
     Value: (paste the libsql:// URL from Turso)
     Environments: tick all three (Production, Preview, Development)
   Click "Save"
5. Add the second variable:
     Name:  TURSO_AUTH_TOKEN
     Value: (paste the long auth token from Turso)
     Environments: tick all three
   Click "Save"
```

Also add the same variables locally so `npm run dev` keeps working. Tell the user to create a file at the project root named `.env.local` with:

```
TURSO_DATABASE_URL=libsql://your-db-name-yourname.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

Then add `.env.local` to `.gitignore` if it isn't already (it should be — Next.js's default `.gitignore` includes it).

---

## PHASE 7 — Push and verify (USER + YOU)

User pushes via GitHub Desktop:

```
1. Open GitHub Desktop
2. You'll see a list of changed files (db.ts, package.json, route.ts files, etc.)
3. In the bottom-left, type a commit message: "Migrate to Turso + add PWA"
4. Click "Commit to main"
5. Click "Push origin" at the top
6. Vercel will auto-deploy in ~1 minute
```

### Your verification checklist (in order)

After the user confirms deploy succeeded:

1. **Visit the live URL on laptop.** It should load.
2. **Create a flavour.** Should succeed (this was the broken case).
3. **Refresh the page.** The flavour should still be there (proves Turso persistence).
4. **Create a branch.** Same.
5. **Visit the URL on phone.** Should load.
6. **On phone (Safari iOS):** tap Share → "Add to Home Screen". App icon should appear on home screen. Tapping it should open in standalone (no browser UI).
7. **On laptop (Chrome):** click the install button in the URL bar (or three-dot menu → "Install uBlend Stock"). App should install as a desktop window.

If any step fails, see Rollback below.

---

## Rollback procedures

### If `npm install` fails after Phase 2

Revert `package.json` to the original (better-sqlite3 + @types/better-sqlite3 in deps), run `npm install`. App goes back to local-only mode. No code changes needed because db.ts is still the old version.

### If the build fails on Vercel after pushing

The error will show in Vercel's deploy log. Most likely causes:
- TypeScript error in one of the route files → fix the type cast (`as number`, `as any`).
- Missing import → add it.
- The `.env.local` is not set in production → set the env vars in Vercel (Phase 6).

### If the build succeeds but API calls return 500

Open the Vercel Function logs (Vercel project → "Logs" tab). Look for:
- `TURSO_DATABASE_URL is not set` → env var not added in Vercel. Re-do Phase 6.
- `no such table: flavours` → schema not applied to Turso. Re-do Phase 1 step 7 (run schema.sql in Turso console).
- Authentication errors → wrong token. Re-generate in Turso, re-paste to Vercel, click "Redeploy" on the latest deployment.

### If the PWA won't install

- Check Chrome DevTools → Application → Manifest. If it shows errors, the manifest.json is malformed.
- Check Application → Service Workers. If no SW registered, the `ServiceWorkerRegister` component isn't rendering (check the browser console for errors).
- Check that `/icons/icon-192.png` and `/icons/icon-512.png` actually exist (visit them directly in the browser).

### Total rollback (if everything is broken)

The user can revert in GitHub Desktop:
- "History" tab → right-click the migration commit → "Revert this commit" → push.
- Vercel auto-redeploys to the previous (broken-but-stable) state.

---

## For the user — keeping the app "versatile" after this migration

This migration is designed so the user can keep editing freely. After it's done:

- **All UI changes are unchanged.** Edit anything in `src/app/*/page.tsx`, `src/components/*`, `src/app/globals.css`, `tailwind.config.ts` — push to GitHub — Vercel auto-deploys. No database concerns.
- **Adding a new field to a flavour/branch?** Three steps:
  1. Add the column to `src/lib/schema.sql` (e.g. `ALTER TABLE flavours ADD COLUMN colour TEXT`).
  2. Run that ALTER statement in the Turso web console.
  3. Update the relevant route + page.
- **Adding a new table?** Same — edit `schema.sql`, run it in Turso console, add a route.
- **Local dev** still works exactly as before via `START-UBLEND.command`. The only difference is that it now talks to the cloud Turso DB (via `.env.local`) instead of a local file. If the user wants a separate local-only DB, they can create a second Turso DB called `ublend-stock-dev` and use a different `.env.local`.

---

## Final reply template (for after all code changes are done)

When you finish the code changes, send the user a SHORT message that:

1. Tells them to run `npm install` in their terminal.
2. Walks them through Phase 1 (Turso setup) — verbatim from this doc.
3. Walks them through Phase 5f (icons) — verbatim from this doc.
4. Walks them through Phase 6 (Vercel env vars + .env.local) — verbatim from this doc.
5. Walks them through Phase 7 (push via GitHub Desktop).
6. Tells them what to test after deploy succeeds.

Keep the tone simple — the user is non-technical. Use numbered lists. No jargon. Don't dump this whole document on them.
