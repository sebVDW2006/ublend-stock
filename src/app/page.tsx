"use client";

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

export default function DashboardPage() {
  const [data, setData] = useState<BranchStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports?view=stock");
      const rows = await res.json();
      setData(rows);
    } catch (err) {
      console.error(err);
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

  const totalBranches = Object.keys(groupedByBranch).length;
  const totalLow = data.filter((r) => r.is_low).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-sm text-slate-600">Total Branches</div>
          <div className="text-3xl font-bold text-brand">{totalBranches}</div>
        </div>
        <div className={`p-4 rounded border ${totalLow > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
          <div className="text-sm text-slate-600">Low Stock Alerts</div>
          <div className={`text-3xl font-bold ${totalLow > 0 ? "text-red-600" : "text-slate-600"}`}>
            {totalLow}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByBranch)
          .sort(([, a], [, b]) => a.branch_name.localeCompare(b.branch_name))
          .map(([branchId, { branch_name, rows }]) => (
            <div
              key={branchId}
              className="bg-white rounded border border-slate-200 overflow-hidden"
            >
              <div className="bg-slate-100 px-4 py-3 font-semibold">{branch_name}</div>
              <table className="w-full">
                <thead className="bg-slate-50 text-sm">
                  <tr>
                    <th className="border-t border-slate-200 px-4 py-2 text-left font-medium">
                      Flavour
                    </th>
                    <th className="border-t border-slate-200 px-4 py-2 text-right font-medium">
                      Remaining
                    </th>
                    <th className="border-t border-slate-200 px-4 py-2 text-left font-medium">
                      Last Checked
                    </th>
                    <th className="border-t border-slate-200 px-4 py-2 text-center font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .sort((a, b) => a.flavour_name.localeCompare(b.flavour_name))
                    .map((row) => (
                      <tr
                        key={row.flavour_id}
                        className={row.is_low ? "bg-red-50" : "hover:bg-slate-50"}
                      >
                        <td className="border-t border-slate-200 px-4 py-3">
                          {row.flavour_name}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 text-right font-medium">
                          {row.estimated_remaining} {row.unit}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                          {row.last_checked_at ? (
                            <>
                              {row.last_checked_at}
                              <br />
                              <span className="text-xs">
                                (was {row.last_check_remaining} {row.unit})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">Never checked</span>
                          )}
                        </td>
                        <td className="border-t border-slate-200 px-4 py-3 text-center">
                          {row.is_low && (
                            <span className="inline-block px-2 py-1 bg-red-500 text-white text-xs font-semibold rounded">
                              LOW
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
