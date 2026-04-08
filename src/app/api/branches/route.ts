import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/branches          → list all branches
// POST   /api/branches          → create { name, address?, contact_name?, contact_phone?, notes? }
// PATCH  /api/branches?id=N     → update any subset of fields
// DELETE /api/branches?id=N     → soft-delete (set active=0)

export async function GET() {
  const db = getDb();
  const result = await db.execute("SELECT * FROM branches ORDER BY active DESC, name ASC");
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { name, address, contact_name, contact_phone, notes } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const insertResult = await db.execute({
      sql: `INSERT INTO branches (name, address, contact_name, contact_phone, notes)
            VALUES (?, ?, ?, ?, ?)`,
      args: [name.trim(), address || null, contact_name || null, contact_phone || null, notes || null],
    });

    const id = Number(insertResult.lastInsertRowid);
    const row = (await db.execute({
      sql: "SELECT * FROM branches WHERE id = ?",
      args: [id],
    })).rows[0];

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
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
    const { name, address, contact_name, contact_phone, notes, active } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push("name = ?"); values.push(name); }
    if (address !== undefined) { updates.push("address = ?"); values.push(address); }
    if (contact_name !== undefined) { updates.push("contact_name = ?"); values.push(contact_name); }
    if (contact_phone !== undefined) { updates.push("contact_phone = ?"); values.push(contact_phone); }
    if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }
    if (active !== undefined) { updates.push("active = ?"); values.push(active ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }

    values.push(id);
    await db.execute({
      sql: `UPDATE branches SET ${updates.join(", ")} WHERE id = ?`,
      args: values,
    });

    const row = (await db.execute({
      sql: "SELECT * FROM branches WHERE id = ?",
      args: [id],
    })).rows[0];
    return NextResponse.json(row);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
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
      sql: "UPDATE branches SET active = 0 WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
