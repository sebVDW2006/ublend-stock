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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topRes, monthlyRes, distRes] = await Promise.all([
        fetch("/api/reports?view=top&period=90"),
        fetch("/api/reports?view=monthly"),
        fetch("/api/reports?view=distributed"),
      ]);
      setTopFlavours(await topRes.json());
      setMonthlyData(await monthlyRes.json());
      setDistributed(await distRes.json());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const maxSold = Math.max(1, ...topFlavours.map((f) => f.sold));

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

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
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {/* Top flavours */}
      <div className="bg-white p-6 rounded border border-slate-200">
        <h2 className="font-semibold text-lg mb-4">Top Flavours (Last 90 Days)</h2>
        {topFlavours.length === 0 ? (
          <p className="text-slate-500">No data yet.</p>
        ) : (
          <div className="space-y-3">
            {topFlavours.map((flavour) => (
              <div key={flavour.flavour_id}>
                <div className="flex justify-between items-baseline mb-1">
                  <div className="font-medium">{flavour.flavour_name}</div>
                  <div className="text-sm text-slate-600">
                    {flavour.sold} units sold / {flavour.delivered} delivered
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded h-4 overflow-hidden">
                  <div
                    className="bg-brand h-full"
                    style={{
                      width: `${(flavour.sold / maxSold) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly sell-through */}
      <div className="bg-white p-6 rounded border border-slate-200">
        <h2 className="font-semibold text-lg mb-4">Monthly Deliveries</h2>
        {Object.keys(groupedByMonth).length === 0 ? (
          <p className="text-slate-500">No data yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByMonth)
              .sort(([aMonth], [bMonth]) => bMonth.localeCompare(aMonth))
              .map(([month, rows]) => (
                <div key={month}>
                  <div className="font-medium mb-2 text-slate-700">{month}</div>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {rows
                        .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                        .map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="px-2 py-1">{row.flavour_name}</td>
                            <td className="px-2 py-1 text-right">
                              {row.delivered} delivered
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Total distributed by branch */}
      <div className="bg-white p-6 rounded border border-slate-200">
        <h2 className="font-semibold text-lg mb-4">Total Distributed by Branch</h2>
        {Object.keys(groupedByBranch).length === 0 ? (
          <p className="text-slate-500">No data yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByBranch)
              .sort(([, a], [, b]) => a.branch_name.localeCompare(b.branch_name))
              .map(([branchId, { branch_name, rows }]) => (
                <div key={branchId}>
                  <div className="font-medium mb-2 text-slate-700">{branch_name}</div>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {rows
                        .filter((r) => r.total_delivered > 0)
                        .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                        .map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="px-2 py-1">{row.flavour_name}</td>
                            <td className="px-2 py-1 text-right">
                              {row.total_delivered} {row.unit}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
