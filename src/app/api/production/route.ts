import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET    /api/production              → list batches (joined with flavour name), newest first
// POST   /api/production               → create { flavour_id, quantity, produced_at, notes? }
// DELETE /api/production?id=N          → delete a batch

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
