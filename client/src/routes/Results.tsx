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

interface ResultCategory extends CategoryScore {
  questionCount: number;
  sectionTitle?: string | null;
}

type ResultData = {
  result: {
    overallSelf: number | null;
    overallOrg: number | null;
    overallCombined: number | null;
    minCategoryScore: number | null;
    maxCategoryScore: number | null;
    scoringVersion: string;
  };
  categories: ResultCategory[];
  expected: number;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

function sectionLabel(order?: number | null) {
  return order === 1 ? "Self" : order === 2 ? "Org" : null;
}

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

  // Per-section Mean/Min/Max of category means — Excel H/I/J mirror (display-only).
  const sectionStats = (order: number) => {
    const avgs = data.categories.filter((c) => c.sectionOrder === order).map((c) => c.averageScore);
    if (avgs.length === 0) return null;
    return {
      mean: avgs.reduce((a, b) => a + b, 0) / avgs.length,
      min: Math.min(...avgs),
      max: Math.max(...avgs),
    };
  };
  const selfStats = sectionStats(1);
  const orgStats = sectionStats(2);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[var(--bets-text-dark)]">Results</h1>
      <div className="flex gap-2">
        <span className="text-sm text-[var(--bets-text-muted)]">Benchmark 75</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Overall Self <span className="font-normal">(Mean)</span></CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--bets-primary)]">{fmt(data.result.overallSelf)}</p>
            <p className="text-xs text-[var(--bets-text-muted)] mt-1">Min {fmt(selfStats?.min)} · Max {fmt(selfStats?.max)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Overall Org <span className="font-normal">(Mean)</span></CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--bets-primary)]">{fmt(data.result.overallOrg)}</p>
            <p className="text-xs text-[var(--bets-text-muted)] mt-1">Min {fmt(orgStats?.min)} · Max {fmt(orgStats?.max)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-[var(--bets-text-muted)]">Combined <span className="font-normal">(Mean)</span></CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--bets-text-dark)]">{fmt(data.result.overallCombined)}</p>
            <p className="text-xs text-[var(--bets-text-muted)] mt-1">Min {fmt(data.result.minCategoryScore)} · Max {fmt(data.result.maxCategoryScore)}</p>
          </CardContent>
        </Card>
      </div>

      {(selfStats || orgStats) && (
        <Card>
          <CardHeader><CardTitle>Section summary <span className="text-xs font-normal text-[var(--bets-text-muted)]">— Mean / Min / Max of category means, as per Excel</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Self", stats: selfStats },
              { label: "Organisation", stats: orgStats },
            ].map(
              (row) =>
                row.stats && (
                  <div key={row.label} className="flex items-center justify-between border-b border-[var(--color-border)] py-2 last:border-0">
                    <span className="text-sm font-medium text-[var(--bets-text)]">{row.label}</span>
                    <span className="flex gap-4 text-sm">
                      <span className="text-[var(--bets-text-muted)]">Mean <b className="text-[var(--bets-primary)]">{fmt(row.stats.mean)}</b></span>
                      <span className="text-[var(--bets-text-muted)]">Min <b className="text-[var(--bets-text)]">{fmt(row.stats.min)}</b></span>
                      <span className="text-[var(--bets-text-muted)]">Max <b className="text-[var(--bets-text)]">{fmt(row.stats.max)}</b></span>
                    </span>
                  </div>
                ),
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Categories <span className="text-xs font-normal text-[var(--bets-text-muted)]">— Mean of question scores</span></CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Category breakdown <span className="text-xs font-normal text-[var(--bets-text-muted)]">— Mean / Min / Max of question scores</span></CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.categories.map((c) => {
            const band = getBand(c.averageScore);
            const tag = sectionLabel(c.sectionOrder);
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                <span className="text-sm text-[var(--bets-text)] flex items-center gap-2 min-w-0">
                  <span className="truncate">{c.name}</span>
                  {tag && <Badge className="bg-[#f5eefb] text-[var(--bets-primary)] shrink-0">{tag}</Badge>}
                  <span className="text-xs text-[var(--bets-text-muted)] shrink-0">n={c.questionCount}</span>
                </span>
                <span className="flex items-center gap-3 text-sm shrink-0">
                  <span className="text-[var(--bets-text-muted)]">Mean <b className="text-[var(--bets-primary)]">{fmt(c.averageScore)}</b></span>
                  <span className="text-[var(--bets-text-muted)]">Min <b className="text-[var(--bets-text)]">{fmt(c.minScore)}</b></span>
                  <span className="text-[var(--bets-text-muted)]">Max <b className="text-[var(--bets-text)]">{fmt(c.maxScore)}</b></span>
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
