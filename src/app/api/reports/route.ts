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
      // Get all deliveries by branch+flavour
      const deliveries = db
        .prepare(
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
        )
        .all() as any[];

      // For each branch+flavour, get the most recent stock check
      const lastChecks = db
        .prepare(
          `SELECT branch_id, flavour_id, checked_at, quantity_remaining
           FROM (
             SELECT sc.branch_id, sci.flavour_id, sc.checked_at, sci.quantity_remaining,
                    ROW_NUMBER() OVER (PARTITION BY sc.branch_id, sci.flavour_id ORDER BY sc.checked_at DESC) as rn
             FROM stock_checks sc
             JOIN stock_check_items sci ON sci.stock_check_id = sc.id
           )
           WHERE rn = 1`
        )
        .all() as any[];

      const lastCheckMap = new Map<string, any>();
      lastChecks.forEach((lc) => {
        lastCheckMap.set(`${lc.branch_id}-${lc.flavour_id}`, lc);
      });

      // Build result with estimated remaining
      const result = deliveries.map((d: any) => {
        const lastCheck = lastCheckMap.get(`${d.branch_id}-${d.flavour_id}`);
        let estimated_remaining = d.delivered_total;
        let last_check_remaining = null;
        let last_checked_at = null;

        if (lastCheck) {
          last_check_remaining = lastCheck.quantity_remaining;
          last_checked_at = lastCheck.checked_at;

          // Add deliveries since last check
          const deliveredSinceLastCheck = db
            .prepare(
              `SELECT COALESCE(SUM(di.quantity), 0) as qty
               FROM deliveries d
               JOIN delivery_items di ON di.delivery_id = d.id
               WHERE d.branch_id = ? AND di.flavour_id = ? AND d.delivered_at > ?`
            )
            .get(d.branch_id, d.flavour_id, lastCheck.checked_at) as any;

          estimated_remaining = last_check_remaining + (deliveredSinceLastCheck?.qty || 0);
        }

        return {
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
        };
      });

      return NextResponse.json(result);
    }
    case "top": {
      // Top flavours by sell-through in the last N days
      // Sell-through = delivered - remaining (from most recent check)
      const rows = db
        .prepare(
          `SELECT f.id, f.name,
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
           LIMIT 10`
        )
        .all(period) as any[];

      const result = rows.map((r) => ({
        flavour_id: r.id,
        flavour_name: r.name,
        delivered: r.delivered_recent,
        sold: r.delivered_recent - r.last_remaining,
      }));

      return NextResponse.json(result);
    }
    case "monthly": {
      // Sell-through by month and flavour
      const rows = db
        .prepare(
          `SELECT f.id, f.name,
                  strftime('%Y-%m', d.delivered_at) as month,
                  COALESCE(SUM(di.quantity), 0) as delivered
           FROM flavours f
           LEFT JOIN delivery_items di ON di.flavour_id = f.id
           LEFT JOIN deliveries d ON d.id = di.delivery_id
           WHERE f.active = 1 AND d.delivered_at IS NOT NULL
           GROUP BY f.id, month
           ORDER BY month DESC, f.name ASC`
        )
        .all() as any[];

      const result = rows.map((r) => ({
        flavour_id: r.id,
        flavour_name: r.name,
        period: r.month,
        delivered: r.delivered,
        sold: 0, // TODO: calculate based on stock checks
      }));

      return NextResponse.json(result);
    }
    case "distributed": {
      // Total delivered by branch and flavour
      const rows = db
        .prepare(
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
        )
        .all() as any[];

      return NextResponse.json(rows);
    }
    default:
      return NextResponse.json({ error: "unknown view" }, { status: 400 });
  }
}
