"use client";

import { useEffect, useState } from "react";

type TopFlavour = {
  flavour_id: number;
  flavour_name: string;
  delivered: number;
  sold: number;
};

type MonthlyRow = {
  flavour_id: number;
  flavour_name: string;
  period: string;
  delivered: number;
  sold: number;
};

type DistributedRow = {
  branch_id: number;
  branch_name: string;
  flavour_id: number;
  flavour_name: string;
  unit: string;
  total_delivered: number;
};

export default function ReportsPage() {
  const [topFlavours, setTopFlavours] = useState<TopFlavour[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [distributed, setDistributed] = useState<DistributedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    try {
      const [topRes, monthlyRes, distributedRes] = await Promise.all([
        fetch("/api/reports?view=top&period=90"),
        fetch("/api/reports?view=monthly"),
        fetch("/api/reports?view=distributed"),
      ]);

      setTopFlavours(await topRes.json());
      setMonthlyData(await monthlyRes.json());
      setDistributed(await distributedRes.json());
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  };

  const maxSold = Math.max(1, ...topFlavours.map((flavour) => flavour.sold));

  const groupedByMonth = monthlyData.reduce(
    (acc, row) => {
      if (!acc[row.period]) acc[row.period] = [];
      acc[row.period].push(row);
      return acc;
    },
    {} as Record<string, MonthlyRow[]>
  );

  const groupedByBranch = distributed.reduce(
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
    {} as Record<number, { branch_name: string; rows: DistributedRow[] }>
  );

  return (
    <div className="space-y-8 pb-8">
      <section className="hero-shell">
        <div className="crm-card p-7 sm:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="data-chip">Reports</span>
            <span className="data-chip data-chip-accent">Movement view</span>
          </div>

          <h1 className="section-title mt-5 max-w-4xl">Read demand without digging through noise.</h1>
          <p className="section-copy mt-5 max-w-2xl">
            The reporting layer stays minimal: top performers, monthly movement, and total distribution by branch.
          </p>

          <div className="hero-stat-grid mt-8">
            <div className="stat-tile">
              <div className="stat-label">Top flavours</div>
              <div className="stat-value">{topFlavours.length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Tracked months</div>
              <div className="stat-value">{Object.keys(groupedByMonth).length}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Reported branches</div>
              <div className="stat-value">{Object.keys(groupedByBranch).length}</div>
            </div>
          </div>
        </div>

        <div className="photo-card min-h-[360px] sm:min-h-[420px]" style={{ backgroundImage: "url('/imagery/berries-dark.jpeg')" }}>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6">
            <span className="data-chip data-chip-blue">Clear movement patterns</span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="empty-state">Loading reports…</div>
      ) : (
        <div className="space-y-4">
          <section className="crm-card p-6 sm:p-8">
            <div className="eyebrow">Top flavours</div>
            <h2 className="section-subtitle mt-3">Best sellers in the last 90 days</h2>

            {topFlavours.length === 0 ? (
              <div className="empty-state mt-6">No report data yet.</div>
            ) : (
              <div className="mt-6 space-y-4">
                {topFlavours.map((flavour) => (
                  <div key={flavour.flavour_id} className="list-card">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.05em]">{flavour.flavour_name}</div>
                        <div className="mt-1 text-sm text-[rgba(16,19,17,0.56)]">
                          {flavour.sold} sold from {flavour.delivered} delivered
                        </div>
                      </div>
                      <span className="data-chip data-chip-accent">{Math.round((flavour.sold / Math.max(1, flavour.delivered)) * 100)}% sold</span>
                    </div>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(16,19,17,0.08)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#d8ff54_0%,#ef5a73_100%)]"
                        style={{ width: `${(flavour.sold / maxSold) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="crm-card p-6 sm:p-8">
              <div className="eyebrow">Monthly movement</div>
              <h2 className="section-subtitle mt-3">Deliveries by month</h2>

              {Object.keys(groupedByMonth).length === 0 ? (
                <div className="empty-state mt-6">No monthly delivery data yet.</div>
              ) : (
                <div className="mt-6 space-y-4">
                  {Object.entries(groupedByMonth)
                    .sort(([aMonth], [bMonth]) => bMonth.localeCompare(aMonth))
                    .map(([month, rows]) => (
                      <div key={month} className="list-card">
                        <div className="text-lg font-semibold tracking-[-0.05em]">{month}</div>
                        <div className="mt-4 overflow-x-auto soft-scrollbar">
                          <table className="w-full min-w-[340px]">
                            <thead className="table-head">
                              <tr>
                                <th className="text-left">Flavour</th>
                                <th className="text-right">Delivered</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows
                                .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                                .map((row, index) => (
                                  <tr key={`${month}-${index}`} className="table-row">
                                    <td>{row.flavour_name}</td>
                                    <td className="text-right">{row.delivered}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="crm-card p-6 sm:p-8">
              <div className="eyebrow">Branch totals</div>
              <h2 className="section-subtitle mt-3">Distribution by branch</h2>

              {Object.keys(groupedByBranch).length === 0 ? (
                <div className="empty-state mt-6">No branch distribution data yet.</div>
              ) : (
                <div className="mt-6 space-y-4">
                  {Object.entries(groupedByBranch)
                    .sort(([, a], [, b]) => a.branch_name.localeCompare(b.branch_name))
                    .map(([branchId, { branch_name, rows }]) => (
                      <div key={branchId} className="list-card">
                        <div className="text-lg font-semibold tracking-[-0.05em]">{branch_name}</div>

                        <div className="mt-4 overflow-x-auto soft-scrollbar">
                          <table className="w-full min-w-[340px]">
                            <thead className="table-head">
                              <tr>
                                <th className="text-left">Flavour</th>
                                <th className="text-right">Total delivered</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows
                                .filter((row) => row.total_delivered > 0)
                                .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                                .map((row, index) => (
                                  <tr key={`${branchId}-${index}`} className="table-row">
                                    <td>{row.flavour_name}</td>
                                    <td className="text-right">
                                      {row.total_delivered} {row.unit}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
