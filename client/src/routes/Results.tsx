import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { getBand } from "../lib/bands";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { betsColors } from "../lib/theme";
import type { CategoryScore } from "../lib/types";

type ResultData = {
  result: { overallSelf: number | null; overallOrg: number | null; overallCombined: number | null; scoringVersion: string };
  categories: CategoryScore[];
  expected: number;
};

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<ResultData>(`/results/${id}`)
      .then(setData)
      .catch((e: unknown) => {
        const msg = toMessage(e);
        setErr(msg);
      });
  }, [id]);

  if (err) return <div className="p-8 text-red-600 bg-red-50 border border-red-200 rounded-md">{err} <Link to="/my-assessments" className="underline text-[var(--bets-primary)]">Back</Link></div>;
  if (!data) return <div className="p-8 text-[var(--bets-text-muted)]">Loading results…</div>;

  const chartData = data.categories.map((c) => ({ name: c.name, score: c.averageScore }));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[var(--bets-text-dark)]">Results</h1>
      <div className="flex gap-2">
        <span className="text-sm text-[var(--bets-text-muted)]">Benchmark 75</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Overall Self</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-[var(--bets-primary)]">{data.result.overallSelf?.toFixed(2) ?? "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Overall Org</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-[var(--bets-primary)]">{data.result.overallOrg?.toFixed(2) ?? "—"}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Combined</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-[var(--bets-text-dark)]">{data.result.overallCombined?.toFixed(2) ?? "—"}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: betsColors.textMuted }} interval={0} angle={-10} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fill: betsColors.textMuted }} />
                <Tooltip />
                <ReferenceLine y={75} stroke={betsColors.primary} strokeDasharray="4 4" />
                <Bar dataKey="score" fill={betsColors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Category breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.categories.map((c) => {
            const band = getBand(c.averageScore);
            return (
              <div key={c.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0">
                <span className="text-sm text-[var(--bets-text)]">{c.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--bets-primary)]">{c.averageScore.toFixed(2)}</span>
                  <Badge className={band.id === 1 ? "bg-green-50 text-green-700 border-green-200" : band.id === 4 ? "bg-red-50 text-red-700 border-red-200" : "bg-[#f5eefb] text-[var(--bets-primary)]"}>{band.label}</Badge>
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Link to="/my-assessments" className="text-sm text-[var(--bets-primary)] hover:text-[var(--bets-primary-dark)]">← Back to My Assessments</Link>
      <button onClick={() => window.print()} className="ml-4 text-sm text-[var(--bets-text-muted)] underline">Print</button>
    </div>
  );
}
