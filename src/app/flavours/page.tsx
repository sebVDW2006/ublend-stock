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
    fetchFlavours();
  }, []);

  const fetchFlavours = async () => {
    setLoading(true);
    const res = await fetch("/api/flavours");
    const data = await res.json();
    setFlavours(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const res = await fetch(`/api/flavours?id=${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Update failed");
      } else {
        const res = await fetch("/api/flavours", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Create failed");
      }

      setForm({ name: "", sku: "", unit: "units", low_stock_threshold: 10, notes: "" });
      setEditingId(null);
      await fetchFlavours();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
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
      const res = await fetch(`/api/flavours?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchFlavours();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const handleCancel = () => {
    setForm({ name: "", sku: "", unit: "units", low_stock_threshold: 10, notes: "" });
    setEditingId(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-brand mb-2">🍓 Flavours</h1>
        <p className="text-slate-600">Manage your product range</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">
          {editingId ? "✏️ Edit Flavour" : "➕ New Flavour"}
        </h2>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="e.g., Mango Smoothie"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="input-field"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Unit</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="input-field"
              placeholder="bottles, litres..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Low Stock Alert Threshold</label>
          <input
            type="number"
            min="0"
            value={form.low_stock_threshold}
            onChange={(e) =>
              setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 0 })
            }
            className="input-field"
            placeholder="10"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field"
            rows={2}
            placeholder="Internal notes..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="btn-primary"
          >
            {editingId ? "💾 Update" : "✨ Create Flavour"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Your Flavours</h2>
        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading...</p>
        ) : flavours.length === 0 ? (
          <div className="card p-8 text-center text-slate-600">
            <p className="text-lg">No flavours yet. Create one above! 👆</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {flavours
              .filter((f) => f.active === 1)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((flavour) => (
                <div key={flavour.id} className="card p-4 flex justify-between items-center hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="font-bold text-lg text-slate-800">{flavour.name}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {flavour.sku && <span className="mr-3">SKU: {flavour.sku}</span>}
                      <span className="mr-3">Unit: <strong>{flavour.unit}</strong></span>
                      <span>Alert at: <strong>{flavour.low_stock_threshold}</strong></span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(flavour)}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(flavour.id)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
