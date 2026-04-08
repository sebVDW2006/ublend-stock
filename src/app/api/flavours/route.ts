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
