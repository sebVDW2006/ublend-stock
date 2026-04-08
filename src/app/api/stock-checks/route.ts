import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/stock-checks?branch_id=N    → list stock checks for a branch (newest first), with items
// POST   /api/stock-checks                  → create { branch_id, checked_at, notes?, items: [{ flavour_id, quantity_remaining }] }
// DELETE /api/stock-checks?id=N             → delete a stock check (items cascade)
//
// Sell-through calculation (handled in /api/reports):
//   For consecutive stock checks at the same branch+flavour:
//     sold = previous_remaining + delivered_between - current_remaining
//   The "first" stock check has no previous remaining, so sold = delivered_before_check - current_remaining

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branch_id");

  const rows = (branchId
    ? db
        .prepare(
          `SELECT * FROM stock_checks WHERE branch_id = ? ORDER BY checked_at DESC, id DESC`,
        )
        .all(branchId)
    : db
        .prepare(`SELECT * FROM stock_checks ORDER BY checked_at DESC, id DESC`)
        .all()) as any[];

  // Fetch items for each check
  const result = rows.map((check) => {
    const items = db
      .prepare(
        `SELECT sci.flavour_id, f.name as flavour_name, f.unit, sci.quantity_remaining
         FROM stock_check_items sci
         JOIN flavours f ON f.id = sci.flavour_id
         WHERE sci.stock_check_id = ?`
      )
      .all(check.id) as any[];
    return { ...check, items };
  });

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

    const result = db.transaction(() => {
      const checkStmt = db.prepare(
        `INSERT INTO stock_checks (branch_id, checked_at, notes)
         VALUES (?, ?, ?)`
      );
      const checkResult = checkStmt.run(
        branch_id,
        checked_at || new Date().toISOString().split("T")[0],
        notes || null
      );
      const checkId = (checkResult as any).lastInsertRowid;

      const itemStmt = db.prepare(
        `INSERT INTO stock_check_items (stock_check_id, flavour_id, quantity_remaining)
         VALUES (?, ?, ?)`
      );
      for (const item of items) {
        itemStmt.run(checkId, item.flavour_id, item.quantity_remaining);
      }

      return checkId;
    })();

    return NextResponse.json({ id: result }, { status: 201 });
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

    db.prepare("DELETE FROM stock_checks WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete stock check" }, { status: 500 });
  }
}
