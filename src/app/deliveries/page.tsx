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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [deliveryRes, branchRes, flavourRes] = await Promise.all([
      fetch("/api/deliveries"),
      fetch("/api/branches"),
      fetch("/api/flavours"),
    ]);
    const nextDeliveries = await deliveryRes.json();
    const nextBranches = await branchRes.json();
    const nextFlavours = await flavourRes.json();
    setDeliveries(nextDeliveries);
    setBranches(nextBranches.filter((branch: Branch) => branch.active === 1));
    setFlavours(nextFlavours.filter((flavour: Flavour) => flavour.active === 1));
    setLoading(false);
  };

  const handleAddItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, { flavour_id: "", quantity: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof DeliveryItem, value: string) => {
    setForm((current) => {
      const nextItems = [...current.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...current, items: nextItems };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.branch_id || form.items.length === 0) {
      alert("Branch and at least one item required");
      return;
    }

    try {
      const response = await fetch("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          branch_id: Number.parseInt(form.branch_id, 10),
          delivered_at: form.delivered_at,
          notes: form.notes || null,
          items: form.items.map((item) => ({
            flavour_id: Number.parseInt(item.flavour_id, 10),
            quantity: Number.parseInt(item.quantity, 10),
          })),
        }),
      });

      if (!response.ok) throw new Error("Create failed");

      setForm({
        branch_id: "",
        delivered_at: new Date().toISOString().split("T")[0],
        notes: "",
        items: [{ flavour_id: "", quantity: "" }],
      });
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this delivery?")) return;

    try {
      const response = await fetch(`/api/deliveries?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchData();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const totalCases = deliveries.reduce(
    (sum, delivery) => sum + delivery.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Deliveries</span>
            <span className="data-chip data-chip-accent">Branch dispatch</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Send stock out cleanly.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            Log every branch delivery in one place so your branch balances and reports reflect what actually moved.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Deliveries logged</div>
              <div className="stat-value">{deliveries.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Active branches</div>
              <div className="stat-value">{branches.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Units moved</div>
              <div className="stat-value">{totalCases}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/strawberry-slices.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip data-chip-accent">Dispatch with clarity</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={handleSubmit} className="crm-card p-6 sm:p-8 space-y-5">
          <div>
            <div className="eyebrow">New delivery</div>
            <h2 className="section-subtitle mt-3">Record outgoing stock</h2>
            <p className="section-copy mt-3">Choose the branch, add the products, and keep the note field brief.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>Branch</label>
              <select required value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })}>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Delivery date</label>
              <input
                type="date"
                value={form.delivered_at}
                onChange={(event) => setForm({ ...form, delivered_at: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Optional route or handover note"
            />
          </div>

          <div>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <label className="mb-0">Items</label>
              <button type="button" onClick={handleAddItem} className="btn-ghost w-full justify-center sm:w-auto">
                Add item
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {form.items.map((item, index) => (
                <div key={`${index}-${item.flavour_id}`} className="soft-panel p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                    <select
                      required
                      value={item.flavour_id}
                      onChange={(event) => handleItemChange(index, "flavour_id", event.target.value)}
                    >
                      <option value="">Select flavour</option>
                      {flavours.map((flavour) => (
                        <option key={flavour.id} value={flavour.id}>
                          {flavour.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                      placeholder="Qty"
                    />

                    {form.items.length > 1 ? (
                      <button type="button" onClick={() => handleRemoveItem(index)} className="btn-danger w-full justify-center sm:w-auto">
                        Remove
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full justify-center sm:w-auto">
            Create delivery
          </button>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Recent deliveries</div>
              <h2 className="section-subtitle mt-3">Latest branch drops</h2>
            </div>
            <span className="data-chip data-chip-blue">{loading ? "Loading" : `${deliveries.length} entries`}</span>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading deliveries…</div>
          ) : deliveries.length === 0 ? (
            <div className="empty-state mt-6">No deliveries recorded yet.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {deliveries
                .sort((a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime())
                .map((delivery) => (
                  <div key={delivery.id} className="list-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.05em]">{delivery.branch_name}</div>
                        <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{formatDate(delivery.delivered_at)}</div>
                      </div>
                      <button type="button" onClick={() => handleDelete(delivery.id)} className="btn-danger w-full justify-center sm:w-auto">
                        Delete
                      </button>
                    </div>

                    <div className="mt-4 space-y-3 sm:hidden">
                      {delivery.items.map((item, index) => (
                        <div key={`${delivery.id}-mobile-${index}`} className="soft-panel flex items-center justify-between gap-3 p-4">
                          <div>
                            <div className="font-medium">{item.flavour_name}</div>
                            <div className="mt-1 text-sm text-[rgba(16,19,17,0.46)]">{item.unit}</div>
                          </div>
                          <div className="text-right font-semibold">
                            {item.quantity} {item.unit}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 hidden overflow-x-auto soft-scrollbar sm:block">
                      <table className="w-full min-w-[420px]">
                        <thead className="table-head">
                          <tr>
                            <th className="text-left">Flavour</th>
                            <th className="text-right">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {delivery.items.map((item, index) => (
                            <tr key={`${delivery.id}-${index}`} className="table-row">
                              <td>{item.flavour_name}</td>
                              <td className="text-right">
                                {item.quantity} {item.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {delivery.notes ? (
                      <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.58)]">{delivery.notes}</p>
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
