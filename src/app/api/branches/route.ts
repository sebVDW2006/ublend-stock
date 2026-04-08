import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/branches          → list all branches
// POST   /api/branches          → create { name, address?, contact_name?, contact_phone?, notes? }
// PATCH  /api/branches?id=N     → update any subset of fields
// DELETE /api/branches?id=N     → soft-delete (set active=0)

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM branches ORDER BY active DESC, name ASC").all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  try {
    const body = await req.json();
    const { name, address, contact_name, contact_phone, notes } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const stmt = db.prepare(
      `INSERT INTO branches (name, address, contact_name, contact_phone, notes)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(name.trim(), address || null, contact_name || null, contact_phone || null, notes || null);

    const row = db
      .prepare("SELECT * FROM branches WHERE name = ? ORDER BY id DESC LIMIT 1")
      .get(name.trim());
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

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (address !== undefined) {
      updates.push("address = ?");
      values.push(address);
    }
    if (contact_name !== undefined) {
      updates.push("contact_name = ?");
      values.push(contact_name);
    }
    if (contact_phone !== undefined) {
      updates.push("contact_phone = ?");
      values.push(contact_phone);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      values.push(notes);
    }
    if (active !== undefined) {
      updates.push("active = ?");
      values.push(active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }

    values.push(id);
    const stmt = db.prepare(
      `UPDATE branches SET ${updates.join(", ")} WHERE id = ?`
    );
    stmt.run(...values);

    const row = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);
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

    db.prepare("UPDATE branches SET active = 0 WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
