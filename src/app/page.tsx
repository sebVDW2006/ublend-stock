"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BranchStockRow = {
  branch_id: number;
  branch_name: string;
  flavour_id: number;
  flavour_name: string;
  unit: string;
  delivered_total: number;
  last_check_remaining: number | null;
  last_checked_at: string | null;
  estimated_remaining: number;
  is_low: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Never checked";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<BranchStockRow[]>([]);
  const [activeBranchCount, setActiveBranchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stockRes, branchRes] = await Promise.all([fetch("/api/reports?view=stock"), fetch("/api/branches")]);
      const rows = await stockRes.json();
      const branches = await branchRes.json();
      setData(rows);
      setActiveBranchCount(branches.filter((b: { active: number }) => b.active === 1).length);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const groupedByBranch = data.reduce(
    (acc, row) => {
      if (!acc[row.branch_id]) {
        acc[row.branch_id] = {
          branch_name: row.branch_name,
          rows: [],
        };
      }

      acc[row.branch_id].rows.push(row);
      return acc;
    },
    {} as Record<number, { branch_name: string; rows: BranchStockRow[] }>
  );

  const totalLow = data.filter((row) => row.is_low).length;
  const trackedFlavours = new Set(data.map((row) => row.flavour_id)).size;
  const checkedBranches = new Set(data.filter((row) => row.last_checked_at).map((row) => row.branch_id)).size;

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">uBlend</span>
            <span className="data-chip">Stock</span>
            <span className="data-chip data-chip-accent">Live inventory</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Keep stock clear, branch by branch.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            Production, deliveries, stock checks, and flavour range all stay in one calm workspace. The look matches
            the new uBlend system, but every card still points back to day-to-day operations.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/deliveries" className="btn-primary w-full justify-center sm:w-auto">
              Log delivery
            </Link>
            <Link href="/stock-checks" className="btn-secondary w-full justify-center sm:w-auto">
              Run stock check
            </Link>
            <Link href="/production" className="btn-secondary w-full justify-center sm:w-auto">
              Add production
            </Link>
          </div>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Active branches</div>
              <div className="stat-value">{activeBranchCount}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Tracked flavours</div>
              <div className="stat-value">{trackedFlavours}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Checked recently</div>
              <div className="stat-value">{checkedBranches}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Low alerts</div>
              <div className="stat-value">{totalLow}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/canyon-green.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="data-chip">Operational view</span>
              <span className="data-chip data-chip-accent">Clear stock picture</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="crm-card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Branch inventory</div>
              <h2 className="section-subtitle mt-3">What needs attention right now.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="data-chip data-chip-berry">{totalLow} low</span>
              <span className="data-chip data-chip-blue">{activeBranchCount} live branches</span>
            </div>
          </div>

          {loading ? (
            <div className="empty-state mt-6">Loading branch inventory…</div>
          ) : Object.keys(groupedByBranch).length === 0 ? (
            <div className="empty-state mt-6">No stock data yet. Start with deliveries or a stock check.</div>
          ) : (
            <div className="mt-6 space-y-4">
              {Object.entries(groupedByBranch)
                .sort(([, a], [, b]) => a.branch_name.localeCompare(b.branch_name))
                .map(([branchId, { branch_name, rows }]) => {
                  const lowCount = rows.filter((row) => row.is_low).length;

                  return (
                    <div key={branchId} className="list-card">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold tracking-[-0.05em]">{branch_name}</h3>
                          <p className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">
                            Last check{" "}
                            {rows.some((row) => row.last_checked_at)
                              ? formatDate(rows.find((row) => row.last_checked_at)?.last_checked_at ?? null)
                              : "not logged yet"}
                          </p>
                        </div>

                        <span className={lowCount > 0 ? "inventory-badge inventory-badge-low" : "inventory-badge inventory-badge-ok"}>
                          {lowCount > 0 ? `${lowCount} low item${lowCount > 1 ? "s" : ""}` : "All clear"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3 sm:hidden">
                        {rows
                          .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                          .map((row) => (
                            <div key={row.flavour_id} className="soft-panel p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium">{row.flavour_name}</div>
                                  <div className="mt-1 text-sm text-[rgba(16,19,17,0.46)]">{row.unit}</div>
                                </div>
                                <span className={row.is_low ? "inventory-badge inventory-badge-low" : "inventory-badge inventory-badge-ok"}>
                                  {row.is_low ? "Low" : "Healthy"}
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="eyebrow">Estimated</div>
                                  <div className="mt-2 font-semibold">
                                    {row.estimated_remaining} {row.unit}
                                  </div>
                                </div>
                                <div>
                                  <div className="eyebrow">Delivered</div>
                                  <div className="mt-2">
                                    {row.delivered_total} {row.unit}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <div className="eyebrow">Last count</div>
                                  <div className="mt-2 text-[rgba(16,19,17,0.62)]">
                                    {row.last_check_remaining === null ? "No manual check yet" : `${row.last_check_remaining} ${row.unit}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      <div className="mt-4 hidden overflow-x-auto soft-scrollbar sm:block">
                        <table className="w-full min-w-[560px]">
                          <thead className="table-head">
                            <tr>
                              <th className="text-left">Flavour</th>
                              <th className="text-right">Estimated</th>
                              <th className="text-left">Last count</th>
                              <th className="text-right">Delivered</th>
                              <th className="text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows
                              .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                              .map((row) => (
                                <tr key={row.flavour_id} className="table-row">
                                  <td>
                                    <div className="font-medium">{row.flavour_name}</div>
                                    <div className="mt-1 text-sm text-[rgba(16,19,17,0.46)]">{row.unit}</div>
                                  </td>
                                  <td className="text-right font-semibold">
                                    {row.estimated_remaining} {row.unit}
                                  </td>
                                  <td>
                                    {row.last_check_remaining === null ? (
                                      <span className="text-sm text-[rgba(16,19,17,0.42)]">No manual check yet</span>
                                    ) : (
                                      <span className="text-sm text-[rgba(16,19,17,0.62)]">
                                        {row.last_check_remaining} {row.unit}
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-right text-[rgba(16,19,17,0.72)]">
                                    {row.delivered_total} {row.unit}
                                  </td>
                                  <td className="text-center">
                                    <span className={row.is_low ? "inventory-badge inventory-badge-low" : "inventory-badge inventory-badge-ok"}>
                                      {row.is_low ? "Low" : "Healthy"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="crm-card p-6">
            <div className="eyebrow">Quick actions</div>
            <div className="mt-4 space-y-3">
              <Link href="/deliveries" className="list-card">
                <div className="text-lg font-semibold tracking-[-0.04em]">Deliveries</div>
                <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.58)]">Record what went out to each branch.</p>
              </Link>
              <Link href="/stock-checks" className="list-card">
                <div className="text-lg font-semibold tracking-[-0.04em]">Stock checks</div>
                <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.58)]">Compare expected stock with real counts.</p>
              </Link>
              <Link href="/reports" className="list-card">
                <div className="text-lg font-semibold tracking-[-0.04em]">Reports</div>
                <p className="mt-2 text-sm leading-7 text-[rgba(16,19,17,0.58)]">See movement, sell-through, and demand patterns.</p>
              </Link>
            </div>
          </div>

          <div className="photo-card min-h-[300px]" style={{ backgroundImage: "url('/imagery/berries-dark.jpeg')" }}>
            <div className="absolute inset-x-0 bottom-0 z-10 p-6">
              <div className="flex flex-wrap gap-2">
                <span className="data-chip">Fruit-led palette</span>
                <span className="data-chip data-chip-blue">Still operational</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
