import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/reports?view=stock        → BranchStockRow[]   (dashboard)
// GET /api/reports?view=top&period=N → top flavours by sell-through over last N days
// GET /api/reports?view=monthly      → FlavourSellThroughRow[]   (sell-through by YYYY-MM)
// GET /api/reports?view=distributed  → totals delivered grouped by branch+flavour

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
