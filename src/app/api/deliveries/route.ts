import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/deliveries                 → list deliveries with branch name and items
// POST   /api/deliveries                  → create { branch_id, delivered_at, notes?, items: [{ flavour_id, quantity }] }
// DELETE /api/deliveries?id=N             → delete a delivery (cascade removes its items)

export async function GET() {
  const db = getDb();
  const deliveries = db
    .prepare(
      `SELECT d.*, b.name AS branch_name
         FROM deliveries d
         JOIN branches b ON b.id = d.branch_id
         ORDER BY d.delivered_at DESC, d.id DESC`,
    )
    .all() as any[];

  // Fetch items for each delivery
  const result = deliveries.map((d) => {
    const items = db
      .prepare(
        `SELECT di.flavour_id, f.name as flavour_name, f.unit, di.quantity
         FROM delivery_items di
         JOIN flavours f ON f.id = di.flavour_id
         WHERE di.delivery_id = ?`
      )
      .all(d.id) as any[];
    return { ...d, items };
  });

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

    const result = db.transaction(() => {
      const deliveryStmt = db.prepare(
        `INSERT INTO deliveries (branch_id, delivered_at, notes)
         VALUES (?, ?, ?)`
      );
      const deliveryResult = deliveryStmt.run(
        branch_id,
        delivered_at || new Date().toISOString().split("T")[0],
        notes || null
      );
      const deliveryId = (deliveryResult as any).lastInsertRowid;

      const itemStmt = db.prepare(
        `INSERT INTO delivery_items (delivery_id, flavour_id, quantity)
         VALUES (?, ?, ?)`
      );
      for (const item of items) {
        itemStmt.run(deliveryId, item.flavour_id, item.quantity);
      }

      return deliveryId;
    })();

    return NextResponse.json({ id: result }, { status: 201 });
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

    db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete delivery" }, { status: 500 });
  }
}
