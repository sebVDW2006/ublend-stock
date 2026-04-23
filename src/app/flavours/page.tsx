"use client";

import { useEffect, useState } from "react";
import { Flavour } from "@/lib/types";

export default function FlavoursPage() {
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "units",
    low_stock_threshold: 10,
    notes: "",
  });

  useEffect(() => {
    void fetchFlavours();
  }, []);

  const fetchFlavours = async () => {
    setLoading(true);
    const response = await fetch("/api/flavours");
    const nextFlavours = await response.json();
    setFlavours(nextFlavours);
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (editingId) {
        const response = await fetch(`/api/flavours?id=${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("Update failed");
      } else {
        const response = await fetch("/api/flavours", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("Create failed");
      }

      setForm({ name: "", sku: "", unit: "units", low_stock_threshold: 10, notes: "" });
      setEditingId(null);
      await fetchFlavours();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleEdit = (flavour: Flavour) => {
    setForm({
      name: flavour.name,
      sku: flavour.sku || "",
      unit: flavour.unit,
      low_stock_threshold: flavour.low_stock_threshold,
      notes: flavour.notes || "",
    });
    setEditingId(flavour.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Archive this flavour?")) return;

    try {
      const response = await fetch(`/api/flavours?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchFlavours();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleCancel = () => {
    setForm({ name: "", sku: "", unit: "units", low_stock_threshold: 10, notes: "" });
    setEditingId(null);
  };

  const activeFlavours = flavours.filter((flavour) => flavour.active === 1);

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Flavours</span>
            <span className="data-chip data-chip-accent">Range setup</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Define the range once, use it everywhere.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            Each flavour becomes part of production, deliveries, checks, and reports. Keep the naming and thresholds
            clean so the whole stock system stays consistent.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Active flavours</div>
              <div className="stat-value">{activeFlavours.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Archived</div>
              <div className="stat-value">{flavours.length - activeFlavours.length}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/strawberry-slices.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip data-chip-accent">Fruit-first identity</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <form onSubmit={handleSubmit} className="crm-card p-6 sm:p-8 space-y-5">
          <div>
            <div className="eyebrow">Flavour profile</div>
            <h2 className="section-subtitle mt-3">{editingId ? "Edit flavour" : "Add flavour"}</h2>
          </div>

          <div>
            <label>Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Flavour name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                placeholder="Optional code"
              />
            </div>
            <div>
              <label>Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="bottles, cases, litres"
              />
            </div>
          </div>

          <div>
            <label>Low stock threshold</label>
            <input
              type="number"
              min="0"
              value={form.low_stock_threshold}
              onChange={(event) =>
                setForm({ ...form, low_stock_threshold: Number.parseInt(event.target.value, 10) || 0 })
              }
            />
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Internal note for this flavour"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary w-full justify-center sm:w-auto">
              {editingId ? "Update flavour" : "Create flavour"}
            </button>
            {editingId ? (
              <button type="button" onClick={handleCancel} className="btn-secondary w-full justify-center sm:w-auto">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Flavour list</div>
              <h2 className="section-subtitle mt-3">Current catalogue</h2>
            </div>
            <span className="data-chip data-chip-blue">{loading ? "Loading" : `${activeFlavours.length} active`}</span>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading flavours…</div>
          ) : activeFlavours.length === 0 ? (
            <div className="empty-state mt-6">No flavours yet. Create the first one on the left.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {activeFlavours
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((flavour) => (
                  <div key={flavour.id} className="list-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.05em]">{flavour.name}</div>
                        <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{flavour.sku || "No SKU"} </div>
                      </div>

                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button type="button" onClick={() => handleEdit(flavour)} className="btn-secondary w-full justify-center sm:w-auto">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(flavour.id)} className="btn-danger w-full justify-center sm:w-auto">
                          Archive
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="soft-panel p-4">
                        <div className="eyebrow">Unit</div>
                        <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.62)]">{flavour.unit}</p>
                      </div>
                      <div className="soft-panel p-4">
                        <div className="eyebrow">Low stock threshold</div>
                        <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.62)]">{flavour.low_stock_threshold}</p>
                      </div>
                    </div>

                    {flavour.notes ? <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.58)]">{flavour.notes}</p> : null}
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
