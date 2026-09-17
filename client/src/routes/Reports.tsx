import { useEffect, useState } from "react";
import { apiFetch, API_BASE, getAccessToken } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

type Row = {
  assignmentId: string;
  assessmentTitle: string;
  userEmail?: string;
  userName?: string;
  submittedAt: string;
  overallSelf: number | null;
  overallOrg: number | null;
  overallCombined: number | null;
};

export function ReportsPage() {
  const [data, setData] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState("");

  const fetchReports = async () => {
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (period) qs.set("period", period);
      const res = (await apiFetch<{ data: Row[]; total: number }>(`/reports${qs.toString() ? `?${qs}` : ""}`)) as { data: Row[]; total: number };
      setData(res.data);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = toMessage(e);
      setErr(msg);
    }
  };

  useEffect(() => {
    void fetchReports();
  }, []);

  const downloadCsv = async () => {
    try {
      const token = getAccessToken();
      const qs = new URLSearchParams({ format: "csv" });
      if (period) qs.set("period", period);
      const res = await fetch(`${API_BASE}/reports?${qs}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Reports</h1>
      <p className="text-sm text-[var(--bets-text-muted)]">All submissions — single assessment.</p>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-[var(--bets-text-muted)]">Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm border-[var(--color-border-strong)]">
              <option value="">All time</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="90d">Last 90d</option>
            </select>
          </div>
          <Button onClick={fetchReports} variant="secondary">Filter</Button>
          <Button onClick={downloadCsv}>Download CSV</Button>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Results <Badge>{total} total</Badge></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--bets-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2">User</th>
                  <th className="py-2">Submitted</th>
                  <th className="py-2">Self</th>
                  <th className="py-2">Org</th>
                  <th className="py-2">Combined</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.assignmentId} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 text-[var(--bets-text-muted)]">{r.userEmail ?? "—"} {r.userName ? `· ${r.userName}` : ""}</td>
                    <td className="py-2 text-[var(--bets-text-muted)]">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                    <td className="py-2 font-medium text-[var(--bets-primary)]">{r.overallSelf?.toFixed(2) ?? "—"}</td>
                    <td className="py-2 font-medium text-[var(--bets-primary)]">{r.overallOrg?.toFixed(2) ?? "—"}</td>
                    <td className="py-2 font-semibold text-[var(--bets-text-dark)]">{r.overallCombined?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[var(--bets-text-muted)]">No submitted assignments for filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
