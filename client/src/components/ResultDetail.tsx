import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { getBand } from "../lib/bands";
import { betsColors } from "../lib/theme";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend, Cell } from "recharts";
import type { CategoryScore } from "../lib/types";

export interface ResultCategory extends CategoryScore {
  questionCount: number;
  sectionTitle?: string | null;
}

export type ResultData = {
  result: {
    overallSelf: number | null;
    overallOrg: number | null;
    overallCombined: number | null;
    minCategoryScore: number | null;
    maxCategoryScore: number | null;
    scoringVersion?: string;
  };
  categories: ResultCategory[];
  expected: number;
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));
function sectionLabel(order?: number | null) {
  return order === 1 ? "Self" : order === 2 ? "Org" : null;
}

export function ResultDetail({ data }: { data: ResultData }) {
  const chartData = data.categories.map((c) => {
    const band = getBand(c.averageScore);
    return { name: c.name, short: c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name, score: Number(c.averageScore.toFixed(2)), full: c.name, bandLabel: band.label, color: band.color, section: sectionLabel(c.sectionOrder) ?? "" };
  });
  const groupedData = (() => {
    const byName = new Map<string, { name: string; short: string; Self: number | null; Org: number | null }>();
    for (const c of data.categories) {
      const key = c.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: c.name, short: c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name, Self: null, Org: null });
      const g = byName.get(key)!;
      if (c.sectionOrder === 1) g.Self = c.averageScore;
      else if (c.sectionOrder === 2) g.Org = c.averageScore;
      else if (g.Self == null) g.Self = c.averageScore;
    }
    return Array.from(byName.values()).map((g) => ({
      ...g,
      Self: g.Self != null ? Number(g.Self.toFixed(2)) : null,
      Org: g.Org != null ? Number(g.Org.toFixed(2)) : null,
    }));
  })();

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-sm rounded-xl border-[var(--color-border)] overflow-hidden">
          <div className="h-1 w-full bg-[#743E95]" />
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-[var(--bets-text)]">Overall Self</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-[#743E95] tracking-tight">{fmt(data.result.overallSelf)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-[#f3e8ff] overflow-hidden">
              <div className="h-full bg-[#743E95] rounded-full" style={{ width: `${Math.min(100, data.result.overallSelf ?? 0)}%` }} />
            </div>
            <p className="text-[11px] text-[var(--bets-text-muted)] mt-1.5">Benchmark 75</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl border-[var(--color-border)] overflow-hidden">
          <div className="h-1 w-full bg-[#9B6EC1]" />
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-[var(--bets-text)]">Overall Org</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-[#743E95] tracking-tight">{fmt(data.result.overallOrg)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-[#f3e8ff] overflow-hidden">
              <div className="h-full bg-[#9B6EC1] rounded-full" style={{ width: `${Math.min(100, data.result.overallOrg ?? 0)}%` }} />
            </div>
            <p className="text-[11px] text-[var(--bets-text-muted)] mt-1.5">Benchmark 75</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl border-[var(--color-border)] overflow-hidden bg-gradient-to-br from-white to-[#fcf9ff]">
          <div className="h-1 w-full bg-[var(--bets-text-dark)]" />
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-[var(--bets-text)]">Combined</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-[var(--bets-text-dark)] tracking-tight">{fmt(data.result.overallCombined)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-[#eee] overflow-hidden">
              <div className="h-full bg-[var(--bets-text-dark)] rounded-full" style={{ width: `${Math.min(100, data.result.overallCombined ?? 0)}%` }} />
            </div>
            <p className="text-[11px] text-[var(--bets-text-muted)] mt-1.5">Mean of all categories</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 shadow-sm rounded-xl border-[var(--color-border)]">
          <CardHeader className="pb-1"><CardTitle className="text-sm">Category scores <span className="font-normal text-[var(--bets-text-muted)]">— vs Expected 75</span></CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 6 }}>
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: betsColors.textMuted }} interval={0} tickLine={false} axisLine={{ stroke: "#eee" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: betsColors.textMuted }} tickLine={false} axisLine={{ stroke: "#eee" }} />
                  <Tooltip cursor={{ fill: "#faf5ff" }} contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v, _n, p) => { const pl = p as unknown as { payload: { full: string; bandLabel: string; section: string } }; return [`${v as number}`, `${pl.payload.full} — ${pl.payload.bandLabel} (${pl.payload.section})`]; }} />
                  <ReferenceLine y={75} stroke={betsColors.primary} strokeDasharray="6 4" label={{ position: "right", value: "75", fill: betsColors.primary, fontSize: 11 }} />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={26}>
                    {chartData.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 shadow-sm rounded-xl border-[var(--color-border)]">
          <CardHeader className="pb-1"><CardTitle className="text-sm">Self vs Organisation <span className="font-normal text-[var(--bets-text-muted)]">— per category</span></CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedData} margin={{ top: 8, right: 12, left: -10, bottom: 6 }}>
                  <XAxis dataKey="short" tick={{ fontSize: 11, fill: betsColors.textMuted }} interval={0} tickLine={false} axisLine={{ stroke: "#eee" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: betsColors.textMuted }} tickLine={false} axisLine={{ stroke: "#eee" }} />
                  <Tooltip cursor={{ fill: "#faf5ff" }} contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <ReferenceLine y={75} stroke={betsColors.primary} strokeDasharray="6 4" />
                  <Bar dataKey="Self" fill="#743E95" radius={[6, 6, 0, 0]} barSize={18} name="Self" />
                  <Bar dataKey="Org" fill="#9B6EC1" radius={[6, 6, 0, 0]} barSize={18} name="Org" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm rounded-xl border-[var(--color-border)]">
        <CardHeader><CardTitle className="text-sm">Category breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-0 divide-y divide-[var(--color-border)]">
          {data.categories.map((c) => {
            const band = getBand(c.averageScore);
            const tag = c.sectionOrder === 1 ? "Self" : c.sectionOrder === 2 ? "Org" : null;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-[var(--bets-text)] flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{c.name}</span>
                  {tag && <Badge className="bg-[#f5eefb] text-[var(--bets-primary)] shrink-0 text-[11px]">{tag}</Badge>}
                </span>
                <span className="flex items-center gap-3 text-sm shrink-0">
                  <span className="font-bold text-[#743E95] text-[15px]">{fmt(c.averageScore)}</span>
                  <Badge className={band.id === 1 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : band.id === 4 ? "bg-red-50 text-red-700 border-red-200" : band.id === 3 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-[#f5eefb] text-[var(--bets-primary)] border-[#e9d5ff]"}>{band.label}</Badge>
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
