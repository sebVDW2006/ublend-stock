"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { FuelFillUp } from "@/lib/types";

type FuelForm = {
  filled_at: string;
  total_cost: string;
  notes: string;
  receipt_image_data_url: string | null;
  receipt_image_name: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

async function compressReceiptImage(file: File) {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Could not load image"));
    nextImage.src = originalDataUrl;
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare image");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function FuelPage() {
  const [fillUps, setFillUps] = useState<FuelFillUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FuelForm>({
    filled_at: new Date().toISOString().split("T")[0],
    total_cost: "",
    notes: "",
    receipt_image_data_url: null,
    receipt_image_name: null,
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/fuel");
      const rows = await response.json();
      setFillUps(rows);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file for the receipt.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const compressedDataUrl = await compressReceiptImage(file);
      const imageBytes = dataUrlToBytes(compressedDataUrl);

      if (imageBytes > 1_800_000) {
        throw new Error("The receipt image is still too large after compression.");
      }

      setForm((current) => ({
        ...current,
        receipt_image_data_url: compressedDataUrl,
        receipt_image_name: file.name,
      }));
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "Could not upload receipt"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const clearReceipt = () => {
    setForm((current) => ({
      ...current,
      receipt_image_data_url: null,
      receipt_image_name: null,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedCost = Number.parseFloat(form.total_cost);
    if (!form.filled_at || Number.isNaN(parsedCost) || parsedCost < 0) {
      alert("Please add the fill-up date and a valid cost.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/fuel", {
        method: "POST",
        body: JSON.stringify({
          filled_at: form.filled_at,
          total_cost_pence: Math.round(parsedCost * 100),
          notes: form.notes || null,
          receipt_image_data_url: form.receipt_image_data_url,
          receipt_image_name: form.receipt_image_name,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Create failed");
      }

      setForm({
        filled_at: new Date().toISOString().split("T")[0],
        total_cost: "",
        notes: "",
        receipt_image_data_url: null,
        receipt_image_name: null,
      });

      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this fuel fill-up?")) return;

    try {
      const response = await fetch(`/api/fuel?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const totalSpendPence = fillUps.reduce((sum, fillUp) => sum + fillUp.total_cost_pence, 0);
  const receiptsLogged = fillUps.filter((fillUp) => fillUp.receipt_image_data_url).length;
  const latestFillUp = fillUps[0] ?? null;

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Fuel log</span>
            <span className="data-chip data-chip-accent">Vehicle costs</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Keep every petrol fill-up in one place.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            Log when you filled up, what it cost, and attach the receipt image so the running record stays easy to
            check later.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Fill-ups logged</div>
              <div className="stat-value">{fillUps.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Total spend</div>
              <div className="stat-value text-[1.5rem] sm:text-[1.95rem]">{formatMoney(totalSpendPence)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Receipts saved</div>
              <div className="stat-value">{receiptsLogged}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Latest fill-up</div>
              <div className="stat-value text-[1.2rem] sm:text-[1.5rem]">
                {latestFillUp ? formatDate(latestFillUp.filled_at) : "None yet"}
              </div>
            </div>
          </div>
        </div>

        <div
          className="photo-card min-h-[360px] sm:min-h-[420px]"
          style={{ backgroundImage: "url('/imagery/cherries-gloss.jpeg')" }}
        >
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <div className="flex flex-wrap gap-2">
              <span className="data-chip">Receipts attached</span>
              <span className="data-chip data-chip-blue">Costs tracked</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <form onSubmit={handleSubmit} className="crm-card space-y-5 p-6 sm:p-8">
          <div>
            <div className="eyebrow">New fill-up</div>
            <h2 className="section-subtitle mt-3">Record the latest petrol stop</h2>
            <p className="section-copy mt-3">
              Add the date, total cost, and an optional receipt image. Images are compressed automatically to keep the
              log lightweight.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>Date filled</label>
              <input
                type="date"
                value={form.filled_at}
                onChange={(event) => setForm((current) => ({ ...current, filled_at: event.target.value }))}
              />
            </div>

            <div>
              <label>Total cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.total_cost}
                onChange={(event) => setForm((current) => ({ ...current, total_cost: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional note, for example motorway stop or full tank"
            />
          </div>

          <div className="space-y-3">
            <label>Receipt image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />

            {uploading ? <div className="empty-state p-4">Preparing receipt image…</div> : null}

            {form.receipt_image_data_url ? (
              <div className="soft-panel p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{form.receipt_image_name || "Receipt image"}</div>
                    <p className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">
                      Saved with this entry once you submit the fill-up.
                    </p>
                  </div>
                  <button type="button" onClick={clearReceipt} className="btn-danger w-full justify-center sm:w-auto">
                    Remove image
                  </button>
                </div>

                <img
                  src={form.receipt_image_data_url}
                  alt="Receipt preview"
                  className="mt-4 max-h-[420px] w-full rounded-[20px] border border-[rgba(16,19,17,0.08)] object-contain bg-white"
                />
              </div>
            ) : null}
          </div>

          <button type="submit" disabled={saving || uploading} className="btn-primary w-full justify-center sm:w-auto">
            {saving ? "Saving fill-up…" : "Save fill-up"}
          </button>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">History</div>
              <h2 className="section-subtitle mt-3">Fuel costs over time</h2>
            </div>
            <span className="data-chip data-chip-blue">{fillUps.length} entries</span>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading fuel log…</div>
          ) : fillUps.length === 0 ? (
            <div className="empty-state mt-6">No fuel fill-ups logged yet.</div>
          ) : (
            <div className="mt-6 space-y-4">
              {fillUps.map((fillUp) => (
                <div key={fillUp.id} className="list-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.05em]">{formatMoney(fillUp.total_cost_pence)}</h3>
                      <p className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{formatDate(fillUp.filled_at)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(fillUp.id)}
                      className="btn-danger w-full justify-center sm:w-auto"
                    >
                      Delete
                    </button>
                  </div>

                  {fillUp.notes ? (
                    <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.72)]">{fillUp.notes}</p>
                  ) : null}

                  {fillUp.receipt_image_data_url ? (
                    <div className="mt-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(16,19,17,0.5)]">
                        Receipt
                      </div>
                      <img
                        src={fillUp.receipt_image_data_url}
                        alt={`Receipt from ${formatDate(fillUp.filled_at)}`}
                        className="max-h-[420px] w-full rounded-[20px] border border-[rgba(16,19,17,0.08)] object-contain bg-white"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[20px] border border-dashed border-[rgba(16,19,17,0.12)] px-4 py-3 text-sm text-[rgba(16,19,17,0.5)]">
                      No receipt image attached
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
