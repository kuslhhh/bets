import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { betsColors } from "../lib/theme";

type Dashboard = {
  personal: { result: { overallSelf: number | null; overallCombined: number | null }; categories: { id: string; name: string; averageScore: number }[] } | null;
  organisation: { categoryAverages: { id: string; name: string; averageScore: number }[]; weakest: { id: string; name: string; averageScore: number }[]; expected: number } | null;
  completion: { total: number; submitted: number; inProgress: number; assigned: number; submittedRate: number } | null;
};

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<Dashboard>("/dashboard")
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  if (err) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{err}</p>;
  if (!data) return <p className="text-sm text-[var(--bets-text-muted)]">Loading…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Dashboard</h1>
      {data.completion && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-[var(--bets-text-muted)]">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-[var(--bets-primary)]">{data.completion.total}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-[var(--bets-text-muted)]">Submitted</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-[var(--bets-text-dark)]">{data.completion.submitted}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-[var(--bets-text-muted)]">In Progress</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold" style={{ color: betsColors.primary }}>
              {data.completion.inProgress}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-[var(--bets-text-muted)]">Submitted Rate</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-[var(--bets-text-dark)]">{(data.completion.submittedRate * 100).toFixed(0)}%</CardContent>
          </Card>
        </div>
      )}
      {data.organisation && (
        <Card>
          <CardHeader>
            <CardTitle>Weakest Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.organisation.weakest.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0">
                <span className="text-sm text-[var(--bets-text)]">{c.name}</span>
                <span className="text-sm font-semibold text-[var(--bets-primary)]">{c.averageScore.toFixed(2)}</span>
              </div>
            ))}
            <p className="text-xs text-[var(--bets-text-muted)]">Expected 75 — scores below are priority.</p>
          </CardContent>
        </Card>
      )}
      {data.personal && (
        <Card>
          <CardHeader>
            <CardTitle>Your latest result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--bets-text-muted)]">
              Overall Combined: <span className="font-semibold text-[var(--bets-primary)]">{data.personal.result.overallCombined?.toFixed(2) ?? "—"}</span>
            </p>
            <div className="mt-3 space-y-1">
              {data.personal.categories.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-[var(--bets-text)]">{c.name}</span>
                  <span className="text-[var(--bets-text-muted)]">{c.averageScore.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
