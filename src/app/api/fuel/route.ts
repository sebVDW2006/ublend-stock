import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const CREATE_FUEL_FILL_UPS_SQL = `
  CREATE TABLE IF NOT EXISTS fuel_fill_ups (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    filled_at               TEXT    NOT NULL,
    total_cost_pence        INTEGER NOT NULL CHECK (total_cost_pence >= 0),
    notes                   TEXT,
    receipt_image_data_url  TEXT,
    receipt_image_name      TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

async function ensureFuelFillUpsTable() {
  const db = getDb();

  await db.execute(CREATE_FUEL_FILL_UPS_SQL);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_fuel_fill_ups_date ON fuel_fill_ups(filled_at)"
  );

  // Safe upgrades for older databases that predate receipt support.
  const tableInfo = await db.execute("PRAGMA table_info(fuel_fill_ups)");
  const columns = new Set(
    tableInfo.rows.map((row) => String(row.name))
  );

  if (!columns.has("receipt_image_data_url")) {
    await db.execute(
      "ALTER TABLE fuel_fill_ups ADD COLUMN receipt_image_data_url TEXT"
    );
  }

  if (!columns.has("receipt_image_name")) {
    await db.execute(
      "ALTER TABLE fuel_fill_ups ADD COLUMN receipt_image_name TEXT"
    );
  }
}

export async function GET() {
  const db = getDb();

  try {
    await ensureFuelFillUpsTable();

    const result = await db.execute(
      `SELECT *
         FROM fuel_fill_ups
        ORDER BY filled_at DESC, id DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load fuel fill-ups" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const db = getDb();

  try {
    await ensureFuelFillUpsTable();

    const body = await req.json();
    const {
      filled_at,
      total_cost_pence,
      notes,
      receipt_image_data_url,
      receipt_image_name,
    } = body;

    if (!filled_at || typeof total_cost_pence !== "number") {
      return NextResponse.json(
        { error: "filled_at and total_cost_pence are required" },
        { status: 400 }
      );
    }

    if (total_cost_pence < 0) {
      return NextResponse.json(
        { error: "total_cost_pence must be zero or greater" },
        { status: 400 }
      );
    }

    if (
      receipt_image_data_url &&
      typeof receipt_image_data_url === "string" &&
      receipt_image_data_url.length > 2_500_000
    ) {
      return NextResponse.json(
        { error: "Receipt image is too large. Please use a smaller photo." },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO fuel_fill_ups (
              filled_at,
              total_cost_pence,
              notes,
              receipt_image_data_url,
              receipt_image_name
            )
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        filled_at,
        total_cost_pence,
        notes || null,
        receipt_image_data_url || null,
        receipt_image_name || null,
      ],
    });

    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create fuel fill-up" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const db = getDb();

  try {
    await ensureFuelFillUpsTable();

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.execute({
      sql: "DELETE FROM fuel_fill_ups WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete fuel fill-up" },
      { status: 500 }
    );
  }
}
