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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [batchRes, flavourRes] = await Promise.all([
      fetch("/api/production"),
      fetch("/api/flavours"),
    ]);
    const batches = await batchRes.json();
    const flavours = await flavourRes.json();
    setBatches(batches);
    setFlavours(flavours.filter((f: Flavour) => f.active === 1));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/production", {
        method: "POST",
        body: JSON.stringify({
          flavour_id: parseInt(form.flavour_id),
          quantity: parseInt(form.quantity),
          produced_at: form.produced_at,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Create failed");

      setForm({
        flavour_id: "",
        quantity: "",
        produced_at: new Date().toISOString().split("T")[0],
        notes: "",
      });
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this batch?")) return;
    try {
      const res = await fetch(`/api/production?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Production</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded border border-slate-200 space-y-3">
        <h2 className="font-semibold text-lg">Log Production Batch</h2>

        <div>
          <label className="block text-sm font-medium">Flavour *</label>
          <select
            required
            value={form.flavour_id}
            onChange={(e) => setForm({ ...form, flavour_id: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded"
          >
            <option value="">— Select flavour —</option>
            {flavours.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Quantity *</label>
            <input
              type="number"
              required
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full px-2 py-1 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Produced Date</label>
            <input
              type="date"
              value={form.produced_at}
              onChange={(e) => setForm({ ...form, produced_at: e.target.value })}
              className="w-full px-2 py-1 border border-slate-300 rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded"
            rows={2}
          />
        </div>

        <button
          type="submit"
          className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-dark"
        >
          Log Batch
        </button>
      </form>

      <div>
        <h2 className="font-semibold text-lg mb-3">Recent Production</h2>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : batches.length === 0 ? (
          <p className="text-slate-500">No batches logged yet.</p>
        ) : (
          <table className="w-full border-collapse border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Date
                </th>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Flavour
                </th>
                <th className="border border-slate-300 px-3 py-2 text-right text-sm font-semibold">
                  Quantity
                </th>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Notes
                </th>
                <th className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {batches
                .sort((a, b) => new Date(b.produced_at).getTime() - new Date(a.produced_at).getTime())
                .map((batch) => (
                  <tr key={batch.id}>
                    <td className="border border-slate-300 px-3 py-2 text-sm">{batch.produced_at}</td>
                    <td className="border border-slate-300 px-3 py-2">{batch.flavour_name}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">
                      {batch.quantity} {batch.unit}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-sm text-slate-600">
                      {batch.notes || "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      <button
                        onClick={() => handleDelete(batch.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
