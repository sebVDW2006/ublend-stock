"use client";

import { useEffect, useState } from "react";
import { Flavour } from "@/lib/types";

type ProductionBatchRow = {
  id: number;
  flavour_id: number;
  flavour_name: string;
  unit: string;
  quantity: number;
  produced_at: string;
  notes: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ProductionPage() {
  const [batches, setBatches] = useState<ProductionBatchRow[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    flavour_id: "",
    quantity: "",
    produced_at: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [batchRes, flavourRes] = await Promise.all([fetch("/api/production"), fetch("/api/flavours")]);
    const nextBatches = await batchRes.json();
    const nextFlavours = await flavourRes.json();
    setBatches(nextBatches);
    setFlavours(nextFlavours.filter((flavour: Flavour) => flavour.active === 1));
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetch("/api/production", {
        method: "POST",
        body: JSON.stringify({
          flavour_id: Number.parseInt(form.flavour_id, 10),
          quantity: Number.parseInt(form.quantity, 10),
          produced_at: form.produced_at,
          notes: form.notes || null,
        }),
      });

      if (!response.ok) throw new Error("Create failed");

      setForm({
        flavour_id: "",
        quantity: "",
        produced_at: new Date().toISOString().split("T")[0],
        notes: "",
      });
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this batch?")) return;

    try {
      const response = await fetch(`/api/production?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const totalUnits = batches.reduce((sum, batch) => sum + batch.quantity, 0);

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Production</span>
            <span className="data-chip data-chip-accent">Batch log</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Log what was made, without slowing the floor down.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            One clean entry for every batch. Keep flavour, quantity, date, and notes tidy so stock totals stay reliable
            across the whole system.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Logged batches</div>
              <div className="stat-value">{batches.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Tracked units</div>
              <div className="stat-value">{totalUnits}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Active flavours</div>
              <div className="stat-value">{flavours.length}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/cherries-gloss.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip data-chip-accent">Fresh batch rhythm</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={handleSubmit} className="crm-card p-6 sm:p-8 space-y-5">
          <div>
            <div className="eyebrow">New batch</div>
            <h2 className="section-subtitle mt-3">Add production</h2>
            <p className="section-copy mt-3">Keep this short. Only the details that help stock stay accurate belong here.</p>
          </div>

          <div>
            <label>Flavour</label>
            <select required value={form.flavour_id} onChange={(event) => setForm({ ...form, flavour_id: event.target.value })}>
              <option value="">Select flavour</option>
              {flavours.map((flavour) => (
                <option key={flavour.id} value={flavour.id}>
                  {flavour.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label>Production date</label>
              <input
                type="date"
                value={form.produced_at}
                onChange={(event) => setForm({ ...form, produced_at: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Optional batch context"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary w-full justify-center sm:w-auto">
              Log batch
            </button>
          </div>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Recent production</div>
              <h2 className="section-subtitle mt-3">Latest batches</h2>
            </div>
            <span className="data-chip data-chip-blue">{loading ? "Loading" : `${batches.length} total`}</span>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading production history…</div>
          ) : batches.length === 0 ? (
            <div className="empty-state mt-6">No production batches logged yet.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {batches
                .sort((a, b) => new Date(b.produced_at).getTime() - new Date(a.produced_at).getTime())
                .map((batch) => (
                  <div key={batch.id} className="list-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.05em]">{batch.flavour_name}</div>
                        <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{formatDate(batch.produced_at)}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="data-chip data-chip-accent">
                          {batch.quantity} {batch.unit}
                        </span>
                        <button type="button" onClick={() => handleDelete(batch.id)} className="btn-danger w-full justify-center sm:w-auto">
                          Delete
                        </button>
                      </div>
                    </div>

                    {batch.notes ? (
                      <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.58)]">{batch.notes}</p>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
