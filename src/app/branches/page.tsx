"use client";

import { useEffect, useState } from "react";
import { Branch } from "@/lib/types";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
  });

  useEffect(() => {
    void fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    const response = await fetch("/api/branches");
    const nextBranches = await response.json();
    setBranches(nextBranches);
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (editingId) {
        const response = await fetch(`/api/branches?id=${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("Update failed");
      } else {
        const response = await fetch("/api/branches", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("Create failed");
      }

      setForm({ name: "", address: "", contact_name: "", contact_phone: "", notes: "" });
      setEditingId(null);
      await fetchBranches();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleEdit = (branch: Branch) => {
    setForm({
      name: branch.name,
      address: branch.address || "",
      contact_name: branch.contact_name || "",
      contact_phone: branch.contact_phone || "",
      notes: branch.notes || "",
    });
    setEditingId(branch.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Archive this branch?")) return;

    try {
      const response = await fetch(`/api/branches?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await fetchBranches();
    } catch (error) {
      alert("Error: " + (error instanceof Error ? error.message : "unknown"));
    }
  };

  const handleCancel = () => {
    setForm({ name: "", address: "", contact_name: "", contact_phone: "", notes: "" });
    setEditingId(null);
  };

  const activeBranches = branches.filter((branch) => branch.active === 1);

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Branches</span>
            <span className="data-chip data-chip-accent">Locations</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Keep every branch in one place.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            Store the basic branch details here so deliveries, stock checks, and reporting always point to the same
            live locations.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Active branches</div>
              <div className="stat-value">{activeBranches.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Archived</div>
              <div className="stat-value">{branches.length - activeBranches.length}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/raspberry-stack.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip">Branch network</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={handleSubmit} className="crm-card p-6 sm:p-8 space-y-5">
          <div>
            <div className="eyebrow">Branch profile</div>
            <h2 className="section-subtitle mt-3">{editingId ? "Edit branch" : "Add branch"}</h2>
          </div>

          <div>
            <label>Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Branch name"
            />
          </div>

          <div>
            <label>Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Optional address"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label>Contact name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(event) => setForm({ ...form, contact_name: event.target.value })}
                placeholder="Optional contact"
              />
            </div>
            <div>
              <label>Contact phone</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(event) => setForm({ ...form, contact_phone: event.target.value })}
                placeholder="Optional phone"
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Internal context for this branch"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary">
              {editingId ? "Update branch" : "Create branch"}
            </button>
            {editingId ? (
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Branch list</div>
              <h2 className="section-subtitle mt-3">Current locations</h2>
            </div>
            <span className="data-chip data-chip-blue">{loading ? "Loading" : `${activeBranches.length} active`}</span>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading branches…</div>
          ) : activeBranches.length === 0 ? (
            <div className="empty-state mt-6">No branches yet. Add the first one on the left.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {activeBranches.map((branch) => (
                <div key={branch.id} className="list-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold tracking-[-0.05em]">{branch.name}</div>
                      {branch.address ? (
                        <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">{branch.address}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleEdit(branch)} className="btn-secondary">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(branch.id)} className="btn-danger">
                        Archive
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="soft-panel p-4">
                      <div className="eyebrow">Contact</div>
                      <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.62)]">{branch.contact_name || "No contact saved"}</p>
                    </div>
                    <div className="soft-panel p-4">
                      <div className="eyebrow">Phone</div>
                      <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.62)]">{branch.contact_phone || "No phone saved"}</p>
                    </div>
                  </div>

                  {branch.notes ? <p className="mt-4 text-sm leading-7 text-[rgba(16,19,17,0.58)]">{branch.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
