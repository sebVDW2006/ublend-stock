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
