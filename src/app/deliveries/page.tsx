"use client";

import { useEffect, useState } from "react";
import { Branch, Flavour } from "@/lib/types";

type DeliveryWithItems = {
  id: number;
  branch_id: number;
  branch_name: string;
  delivered_at: string;
  notes: string | null;
  items: Array<{ flavour_id: number; flavour_name: string; unit: string; quantity: number }>;
};

type DeliveryItem = {
  flavour_id: string;
  quantity: string;
};

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryWithItems[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    branch_id: "",
    delivered_at: new Date().toISOString().split("T")[0],
    notes: "",
    items: [{ flavour_id: "", quantity: "" }] as DeliveryItem[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [delivRes, branchRes, flavourRes] = await Promise.all([
      fetch("/api/deliveries"),
      fetch("/api/branches"),
      fetch("/api/flavours"),
    ]);
    const deliveries = await delivRes.json();
    const branches = await branchRes.json();
    const flavours = await flavourRes.json();
    setDeliveries(deliveries);
    setBranches(branches.filter((b: Branch) => b.active === 1));
    setFlavours(flavours.filter((f: Flavour) => f.active === 1));
    setLoading(false);
  };

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [...form.items, { flavour_id: "", quantity: "" }],
    });
  };

  const handleRemoveItem = (idx: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== idx),
    });
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...form.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.branch_id || form.items.length === 0) {
      alert("Branch and at least one item required");
      return;
    }

    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          branch_id: parseInt(form.branch_id),
          delivered_at: form.delivered_at,
          notes: form.notes || null,
          items: form.items.map((item) => ({
            flavour_id: parseInt(item.flavour_id),
            quantity: parseInt(item.quantity),
          })),
        }),
      });
      if (!res.ok) throw new Error("Create failed");

      setForm({
        branch_id: "",
        delivered_at: new Date().toISOString().split("T")[0],
        notes: "",
        items: [{ flavour_id: "", quantity: "" }],
      });
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this delivery?")) return;
    try {
      const res = await fetch(`/api/deliveries?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Deliveries</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded border border-slate-200 space-y-3">
        <h2 className="font-semibold text-lg">New Delivery</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Branch *</label>
            <select
              required
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              className="w-full px-2 py-1 border border-slate-300 rounded"
            >
              <option value="">— Select branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Delivered Date</label>
            <input
              type="date"
              value={form.delivered_at}
              onChange={(e) => setForm({ ...form, delivered_at: e.target.value })}
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

        <div>
          <label className="block text-sm font-medium mb-2">Items *</label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  required
                  value={item.flavour_id}
                  onChange={(e) => handleItemChange(idx, "flavour_id", e.target.value)}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                >
                  <option value="">— Flavour —</option>
                  {flavours.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                  placeholder="Qty"
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                />
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-2 text-sm px-2 py-1 bg-slate-300 text-slate-800 rounded hover:bg-slate-400"
          >
            + Add Item
          </button>
        </div>

        <button
          type="submit"
          className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-dark"
        >
          Create Delivery
        </button>
      </form>

      <div>
        <h2 className="font-semibold text-lg mb-3">Recent Deliveries</h2>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : deliveries.length === 0 ? (
          <p className="text-slate-500">No deliveries recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {deliveries
              .sort((a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime())
              .map((delivery) => (
                <div
                  key={delivery.id}
                  className="border border-slate-300 rounded p-3 bg-white"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold">{delivery.branch_name}</div>
                      <div className="text-sm text-slate-600">{delivery.delivered_at}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(delivery.id)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {delivery.items.map((item, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="px-2 py-1">{item.flavour_name}</td>
                          <td className="px-2 py-1 text-right">
                            {item.quantity} {item.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {delivery.notes && (
                    <div className="text-xs text-slate-600 mt-2">
                      <strong>Notes:</strong> {delivery.notes}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
