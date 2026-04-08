"use client";

import { useEffect, useState } from "react";
import { Branch, Flavour } from "@/lib/types";

type StockCheckWithItems = {
  id: number;
  branch_id: number;
  checked_at: string;
  notes: string | null;
  items: Array<{ flavour_id: number; flavour_name: string; unit: string; quantity_remaining: number }>;
};

type CheckItem = {
  flavour_id: number;
  flavour_name: string;
  unit: string;
  expected: number;
  quantity_remaining: string;
};

export default function StockChecksPage() {
  const [checks, setChecks] = useState<StockCheckWithItems[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [items, setItems] = useState<CheckItem[]>([]);
  const [form, setForm] = useState({
    branch_id: "",
    checked_at: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [checkRes, branchRes, flavourRes] = await Promise.all([
      fetch("/api/stock-checks"),
      fetch("/api/branches"),
      fetch("/api/flavours"),
    ]);
    const checks = await checkRes.json();
    const branches = await branchRes.json();
    const flavours = await flavourRes.json();
    setChecks(checks);
    setBranches(branches.filter((b: Branch) => b.active === 1));
    setFlavours(flavours.filter((f: Flavour) => f.active === 1));
    setLoading(false);
  };

  const calculateExpected = async (branchId: string) => {
    if (!branchId) return;

    // For each flavour, calculate expected: last_remaining + delivered_since_last_check
    const expectedMap: { [key: number]: number } = {};

    // Get all deliveries to this branch
    const delivRes = await fetch("/api/deliveries");
    const allDeliveries = await delivRes.json();
    const branchDeliveries = allDeliveries
      .filter((d: any) => d.branch_id === parseInt(branchId))
      .sort((a: any, b: any) => new Date(a.delivered_at).getTime() - new Date(b.delivered_at).getTime());

    // Get last stock check for this branch
    const checksRes = await fetch(`/api/stock-checks?branch_id=${branchId}`);
    const branchChecks: StockCheckWithItems[] = await checksRes.json();

    for (const flavour of flavours) {
      let expected = 0;

      // Find last check for this flavour
      let lastRemaining = 0;
      let lastCheckDate = null;
      for (const check of branchChecks) {
        const itemInCheck = check.items.find((i) => i.flavour_id === flavour.id);
        if (itemInCheck) {
          lastRemaining = itemInCheck.quantity_remaining;
          lastCheckDate = check.checked_at;
          break; // latest first
        }
      }

      // Add deliveries since last check
      let deliveredSinceLastCheck = 0;
      for (const delivery of branchDeliveries) {
        if (!lastCheckDate || delivery.delivered_at > lastCheckDate) {
          const item = delivery.items.find((i: any) => i.flavour_id === flavour.id);
          if (item) deliveredSinceLastCheck += item.quantity;
        }
      }

      expected = lastRemaining + deliveredSinceLastCheck;
      expectedMap[flavour.id] = expected;
    }

    const newItems = flavours.map((f) => ({
      flavour_id: f.id,
      flavour_name: f.name,
      unit: f.unit,
      expected: expectedMap[f.id] || 0,
      quantity_remaining: "",
    }));
    setItems(newItems);
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranch(branchId);
    setForm({ ...form, branch_id: branchId });
    calculateExpected(branchId);
  };

  const handleItemChange = (flavourId: number, value: string) => {
    setItems(
      items.map((item) =>
        item.flavour_id === flavourId ? { ...item, quantity_remaining: value } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.branch_id) {
      alert("Branch required");
      return;
    }

    try {
      const filledItems = items.filter((i) => i.quantity_remaining !== "");
      if (filledItems.length === 0) {
        alert("At least one item required");
        return;
      }

      const res = await fetch("/api/stock-checks", {
        method: "POST",
        body: JSON.stringify({
          branch_id: parseInt(form.branch_id),
          checked_at: form.checked_at,
          notes: form.notes || null,
          items: filledItems.map((item) => ({
            flavour_id: item.flavour_id,
            quantity_remaining: parseInt(item.quantity_remaining),
          })),
        }),
      });
      if (!res.ok) throw new Error("Create failed");

      setForm({ branch_id: "", checked_at: new Date().toISOString().split("T")[0], notes: "" });
      setSelectedBranch("");
      setItems([]);
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this stock check?")) return;
    try {
      const res = await fetch(`/api/stock-checks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Stock Checks</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded border border-slate-200 space-y-3">
        <h2 className="font-semibold text-lg">New Stock Check</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Branch *</label>
            <select
              required
              value={form.branch_id}
              onChange={(e) => handleBranchSelect(e.target.value)}
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
            <label className="block text-sm font-medium">Checked Date</label>
            <input
              type="date"
              value={form.checked_at}
              onChange={(e) => setForm({ ...form, checked_at: e.target.value })}
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

        {items.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Actual Remaining *</label>
            <table className="w-full border border-slate-300 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-left">Flavour</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Expected</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Actual</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.flavour_id}>
                    <td className="border border-slate-300 px-2 py-1">{item.flavour_name}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">
                      {item.expected} {item.unit}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        value={item.quantity_remaining}
                        onChange={(e) => handleItemChange(item.flavour_id, e.target.value)}
                        placeholder="0"
                        className="w-full px-1 py-0 border border-slate-300 rounded text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="submit"
          disabled={items.length === 0}
          className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-dark disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          Save Check
        </button>
      </form>

      {selectedBranch && (
        <div>
          <h2 className="font-semibold text-lg mb-3">
            Check History for {branches.find((b) => b.id === parseInt(selectedBranch))?.name}
          </h2>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-3">
              {checks
                .filter((c) => c.branch_id === parseInt(selectedBranch))
                .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
                .map((check) => (
                  <div
                    key={check.id}
                    className="border border-slate-300 rounded p-3 bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-slate-600">{check.checked_at}</div>
                      <button
                        onClick={() => handleDelete(check.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {check.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="px-2 py-1">{item.flavour_name}</td>
                            <td className="px-2 py-1 text-right">
                              {item.quantity_remaining} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {check.notes && (
                      <div className="text-xs text-slate-600 mt-2">
                        <strong>Notes:</strong> {check.notes}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
