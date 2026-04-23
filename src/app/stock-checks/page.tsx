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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [checkRes, branchRes, flavourRes] = await Promise.all([
      fetch("/api/stock-checks"),
      fetch("/api/branches"),
      fetch("/api/flavours"),
    ]);
    const nextChecks = await checkRes.json();
    const nextBranches = await branchRes.json();
    const nextFlavours = await flavourRes.json();
    setChecks(nextChecks);
    setBranches(nextBranches.filter((branch: Branch) => branch.active === 1));
    setFlavours(nextFlavours.filter((flavour: Flavour) => flavour.active === 1));
    setLoading(false);
  };

  const calculateExpected = async (branchId: string) => {
    if (!branchId) return;

    const expectedMap: Record<number, number> = {};
    const deliveryRes = await fetch("/api/deliveries");
    const allDeliveries = await deliveryRes.json();
    const branchDeliveries = allDeliveries
      .filter((delivery: any) => delivery.branch_id === Number.parseInt(branchId, 10))
      .sort((a: any, b: any) => new Date(a.delivered_at).getTime() - new Date(b.delivered_at).getTime());

    const checksRes = await fetch(`/api/stock-checks?branch_id=${branchId}`);
    const branchChecks: StockCheckWithItems[] = await checksRes.json();

    for (const flavour of flavours) {
      let lastRemaining = 0;
      let lastCheckDate: string | null = null;

      for (const check of branchChecks) {
        const itemInCheck = check.items.find((item) => item.flavour_id === flavour.id);
        if (itemInCheck) {
          lastRemaining = itemInCheck.quantity_remaining;
          lastCheckDate = check.checked_at;
          break;
        }
      }

      let deliveredSinceLastCheck = 0;
      for (const delivery of branchDeliveries) {
        if (!lastCheckDate || delivery.delivered_at > lastCheckDate) {
          const item = delivery.items.find((deliveryItem: any) => deliveryItem.flavour_id === flavour.id);
          if (item) deliveredSinceLastCheck += item.quantity;
        }
      }

      expectedMap[flavour.id] = lastRemaining + deliveredSinceLastCheck;
    }

    setItems(
      flavours.map((flavour) => ({
        flavour_id: flavour.id,
        flavour_name: flavour.name,
        unit: flavour.unit,
        expected: expectedMap[flavour.id] || 0,
        quantity_remaining: "",
      }))
    );
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranch(branchId);
    setForm((current) => ({ ...current, branch_id: branchId }));
    void calculateExpected(branchId);
  };

  const handleItemChange = (flavourId: number, value: string) => {
    setItems((current) =>
      current.map((item) => (item.flavour_id === flavourId ? { ...item, quantity_remaining: value } : item))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.branch_id) {
      alert("Branch required");
      return;
    }

    const filledItems = items.filter((item) => item.quantity_remaining !== "");
    if (filledItems.length === 0) {
      alert("At least one item required");
      return;
    }

    try {
      const response = await fetch("/api/stock-checks", {
        method: "POST",
        body: JSON.stringify({
          branch_id: Number.parseInt(form.branch_id, 10),
          checked_at: form.checked_at,
          notes: form.notes || null,
          items: filledItems.map((item) => ({
            flavour_id: item.flavour_id,
            quantity_remaining: Number.parseInt(item.quantity_remaining, 10),
          })),
        }),
      });

      if (!response.ok) throw new Error("Create failed");

      setForm({ branch_id: "", checked_at: new Date().toISOString().split("T")[0], notes: "" });
      setSelectedBranch("");
      setItems([]);
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this stock check?")) return;

    try {
      const response = await fetch(`/api/stock-checks?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const branchChecks = selectedBranch
    ? checks
        .filter((check) => check.branch_id === Number.parseInt(selectedBranch, 10))
        .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
    : [];

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Stock checks</span>
            <span className="data-chip data-chip-accent">Expected vs actual</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Count what is really there.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            The system suggests what each branch should have. You enter the real count and keep the inventory picture
            honest.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Checks logged</div>
              <div className="stat-value">{checks.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Active branches</div>
              <div className="stat-value">{branches.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Tracked flavours</div>
              <div className="stat-value">{flavours.length}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/blueberry-single.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip data-chip-blue">Precise branch counts</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <form onSubmit={handleSubmit} className="crm-card p-6 sm:p-8 space-y-5">
          <div>
            <div className="eyebrow">New stock check</div>
            <h2 className="section-subtitle mt-3">Count remaining stock</h2>
            <p className="section-copy mt-3">Choose a branch first and the expected quantities will load automatically.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>Branch</label>
              <select required value={form.branch_id} onChange={(event) => handleBranchSelect(event.target.value)}>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Checked date</label>
              <input
                type="date"
                value={form.checked_at}
                onChange={(event) => setForm({ ...form, checked_at: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Optional branch context"
            />
          </div>

          {items.length > 0 ? (
            <div className="soft-panel p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="eyebrow">Actual remaining</div>
                <span className="data-chip data-chip-accent">{items.length} flavours</span>
              </div>

              <div className="mt-4 overflow-x-auto soft-scrollbar">
                <table className="w-full min-w-[540px]">
                  <thead className="table-head">
                    <tr>
                      <th className="text-left">Flavour</th>
                      <th className="text-right">Expected</th>
                      <th className="text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.flavour_id} className="table-row">
                        <td>
                          <div className="font-medium">{item.flavour_name}</div>
                          <div className="mt-1 text-sm text-[rgba(16,19,17,0.46)]">{item.unit}</div>
                        </td>
                        <td className="text-right">
                          {item.expected} {item.unit}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.quantity_remaining}
                            onChange={(event) => handleItemChange(item.flavour_id, event.target.value)}
                            placeholder="0"
                            className="max-w-[120px] text-right"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a branch to load expected quantities.</div>
          )}

          <button type="submit" disabled={items.length === 0} className={`btn-primary ${items.length === 0 ? "opacity-50" : ""}`}>
            Save check
          </button>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">History</div>
              <h2 className="section-subtitle mt-3">{selectedBranch ? "Branch check history" : "Recent checks"}</h2>
            </div>
            {selectedBranch ? (
              <span className="data-chip data-chip-blue">
                {branches.find((branch) => branch.id === Number.parseInt(selectedBranch, 10))?.name ?? "Selected branch"}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading stock checks…</div>
          ) : branchChecks.length === 0 ? (
            <div className="empty-state mt-6">
              {selectedBranch ? "No checks for this branch yet." : "Select a branch to view its history."}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {branchChecks.map((check) => (
                <div key={check.id} className="list-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold tracking-[-0.05em]">{formatDate(check.checked_at)}</div>
                      <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{check.items.length} counted lines</div>
                    </div>
                    <button type="button" onClick={() => handleDelete(check.id)} className="btn-danger">
                      Delete
                    </button>
                  </div>

                  <div className="mt-4 overflow-x-auto soft-scrollbar">
                    <table className="w-full min-w-[420px]">
                      <thead className="table-head">
                        <tr>
                          <th className="text-left">Flavour</th>
                          <th className="text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {check.items.map((item, index) => (
                          <tr key={`${check.id}-${index}`} className="table-row">
                            <td>{item.flavour_name}</td>
                            <td className="text-right">
                              {item.quantity_remaining} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {check.notes ? <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.58)]">{check.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
