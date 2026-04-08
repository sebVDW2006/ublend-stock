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
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    const res = await fetch("/api/branches");
    const data = await res.json();
    setBranches(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const res = await fetch(`/api/branches?id=${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Update failed");
      } else {
        const res = await fetch("/api/branches", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Create failed");
      }

      setForm({ name: "", address: "", contact_name: "", contact_phone: "", notes: "" });
      setEditingId(null);
      await fetchBranches();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
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
      const res = await fetch(`/api/branches?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchBranches();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const handleCancel = () => {
    setForm({ name: "", address: "", contact_name: "", contact_phone: "", notes: "" });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Branches</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded border border-slate-200 space-y-3">
        <h2 className="font-semibold text-lg">
          {editingId ? "Edit Branch" : "Add Branch"}
        </h2>

        <div>
          <label className="block text-sm font-medium">Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-2 py-1 border border-slate-300 rounded"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Contact Name</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className="w-full px-2 py-1 border border-slate-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Contact Phone</label>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
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

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-1 bg-brand text-white rounded hover:bg-brand-dark"
          >
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 bg-slate-300 text-slate-800 rounded hover:bg-slate-400"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div>
        <h2 className="font-semibold text-lg mb-3">Branches</h2>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : branches.length === 0 ? (
          <p className="text-slate-500">No branches yet.</p>
        ) : (
          <table className="w-full border-collapse border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Name
                </th>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Contact
                </th>
                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                  Phone
                </th>
                <th className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {branches
                .filter((b) => b.active === 1)
                .map((branch) => (
                  <tr key={branch.id}>
                    <td className="border border-slate-300 px-3 py-2">{branch.name}</td>
                    <td className="border border-slate-300 px-3 py-2 text-sm text-slate-600">
                      {branch.contact_name || "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-sm text-slate-600">
                      {branch.contact_phone || "—"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center space-x-1">
                      <button
                        onClick={() => handleEdit(branch)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(branch.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Archive
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
