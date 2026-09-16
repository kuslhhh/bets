import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { useAuth } from "../lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { betsColors } from "../lib/theme";
import type { CategoryScore } from "../lib/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

type Dashboard = {
  personal: {
    assignment: { id: string; assessmentId: string; attempt?: number; submittedAt: string };
    result: {
      overallSelf: number | null;
      overallOrg: number | null;
      overallCombined: number | null;
      minCategoryScore: number | null;
      maxCategoryScore: number | null;
      selfMinCategoryScore: number | null;
      selfMaxCategoryScore: number | null;
      orgMinCategoryScore: number | null;
      orgMaxCategoryScore: number | null;
      scoringVersion?: string;
    };
    categories: CategoryScore[];
  } | null;
  personalHistory: {
    assignmentId: string;
    attempt: number;
    submittedAt: string;
    assessmentId: string;
    result: {
      overallSelf: number | null;
      overallOrg: number | null;
      overallCombined: number | null;
      minCategoryScore: number | null;
      maxCategoryScore: number | null;
      selfMinCategoryScore: number | null;
      selfMaxCategoryScore: number | null;
      orgMinCategoryScore: number | null;
      orgMaxCategoryScore: number | null;
    };
    categories: CategoryScore[];
  }[];
  organisation: {
    categoryAverages: { id: string; name: string; averageScore: number }[];
    weakest: { id: string; name: string; averageScore: number }[];
    expected: number;
    usersSummary?: { userId: string; name: string; email: string; fillCount: number; latestSubmittedAt: string | null; latestOverallCombined: number | null; latestAttempt: number | null }[];
  } | null;
  completion: { total: number; submitted: number; inProgress: number; assigned: number; submittedRate: number } | null;
  expected: number;
};

export function DashboardPage() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get("userId");
  const targetUserId = paramUserId ?? queryUserId ?? undefined;
  const { hasPermission, role } = useAuth();
  const isAdmin = hasPermission("users.view") || role === "ADMIN";
  const [data, setData] = useState<Dashboard | null>(null);
  const [viewedUser, setViewedUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const qs = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : "";
    apiFetch<Dashboard>(`/dashboard${qs}`)
      .then(setData)
      .catch((e: unknown) => setErr(toMessage(e)));
    if (targetUserId) {
      apiFetch<{ user: { id: string; name: string; email: string } }>(`/users/${targetUserId}`)
        .then((r) => setViewedUser(r.user))
        .catch(() => setViewedUser(null));
    } else setViewedUser(null);
  }, [targetUserId]);
  if (err) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{err}</p>;
  if (!data) return <p className="text-sm text-[var(--bets-text-muted)]">Loading…</p>;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Dashboard {viewedUser ? `— ${viewedUser.name}` : ""}</h1>
        {viewedUser && <span className="text-sm text-[var(--bets-text-muted)]">{viewedUser.name}</span>}
      </div>
      {targetUserId && (
        <p className="text-sm text-[var(--bets-text-muted)]">
          Viewing {viewedUser?.name ?? "user"}’s submissions. <Link to="/admin/users" className="text-[var(--bets-primary)] underline">Back to Users</Link>
        </p>
      )}
      {data.completion && !isAdmin && (
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
        <>
          {!isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Organisation Category Averages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.organisation.categoryAverages.map((c) => ({ name: c.name, score: Number(c.averageScore.toFixed(2)) }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: betsColors.textMuted }} interval={0} angle={-10} textAnchor="end" height={50} />
                        <YAxis domain={[0, 100]} tick={{ fill: betsColors.textMuted }} />
                        <Tooltip />
                        <ReferenceLine y={75} stroke={betsColors.primary} strokeDasharray="4 4" label={{ value: "Expected 75", fill: betsColors.primary, fontSize: 11 }} />
                        <Bar dataKey="score" fill={betsColors.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
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
                  <p className="text-xs text-[var(--bets-text-muted)]">Benchmark 75</p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Users who filled assessments — visible to admin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Users who filled assessments <Badge>{data.organisation.usersSummary?.length ?? 0} users</Badge></CardTitle>
            </CardHeader>
            <CardContent>
              {(data.organisation.usersSummary?.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--bets-text-muted)]">No submissions yet.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--bets-text-muted)] border-b border-[var(--color-border)]">
                        <th className="py-2">Name</th><th>Email</th><th>Fills</th><th>Latest Combined</th><th>Latest Submitted</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.organisation.usersSummary!.map((u) => (
                        <tr key={u.userId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#fcf9ff]">
                          <td className="py-2 font-medium text-[var(--bets-text)]">
                            <Link to={`/admin/users/${u.userId}`} className="text-[var(--bets-primary)] hover:underline">{u.name}</Link>
                          </td>
                          <td className="py-2 text-[var(--bets-text-muted)]">{u.email}</td>
                          <td className="py-2"><Badge className="bg-[#f5eefb] text-[var(--bets-primary)]">{u.fillCount} {u.fillCount === 1 ? "fill" : "fills"}</Badge></td>
                          <td className="py-2 font-semibold text-[var(--bets-primary)]">{u.latestOverallCombined?.toFixed(2) ?? "—"}</td>
                          <td className="py-2 text-[var(--bets-text-muted)]">{u.latestSubmittedAt ? new Date(u.latestSubmittedAt).toLocaleString() : "—"}</td>
                          <td className="py-2"><Link to={`/admin/users/${u.userId}`} className="text-[var(--bets-primary)] hover:underline text-xs">View fills →</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-[var(--bets-text-muted)] mt-2">Click a name to view their submissions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {data.personal && (!isAdmin || targetUserId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{viewedUser ? `${viewedUser.name}'s latest` : "Your latest result"} <Badge>Attempt {data.personal.assignment.attempt ?? "—"}</Badge> <span className="text-xs font-normal text-[var(--bets-text-muted)]">{new Date(data.personal.assignment.submittedAt).toLocaleString()}</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[#fcf9ff]">
                <p className="text-xs text-[var(--bets-text-muted)]">Self</p>
                <p className="text-lg font-bold text-[var(--bets-primary)]">{data.personal.result.overallSelf?.toFixed(2) ?? "—"}</p>
                <p className="text-xs text-[var(--bets-text-muted)]">Min {data.personal.result.selfMinCategoryScore?.toFixed(2) ?? "—"} · Max {data.personal.result.selfMaxCategoryScore?.toFixed(2) ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[#fcf9ff]">
                <p className="text-xs text-[var(--bets-text-muted)]">Organisation</p>
                <p className="text-lg font-bold text-[var(--bets-primary)]">{data.personal.result.overallOrg?.toFixed(2) ?? "—"}</p>
                <p className="text-xs text-[var(--bets-text-muted)]">Min {data.personal.result.orgMinCategoryScore?.toFixed(2) ?? "—"} · Max {data.personal.result.orgMaxCategoryScore?.toFixed(2) ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--bets-text-muted)]">Combined</p>
                <p className="text-lg font-bold text-[var(--bets-text-dark)]">{data.personal.result.overallCombined?.toFixed(2) ?? "—"}</p>
                <p className="text-xs text-[var(--bets-text-muted)]">Min {data.personal.result.minCategoryScore?.toFixed(2) ?? "—"} · Max {data.personal.result.maxCategoryScore?.toFixed(2) ?? "—"}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--bets-text-muted)]">Per category</p>
              {data.personal.categories.map((c) => (
                <div key={c.id} className="flex justify-between text-sm border-b border-[var(--color-border)] py-1.5 last:border-0">
                  <span className="text-[var(--bets-text)]">{c.name} <span className="text-xs text-[var(--bets-text-muted)]">{c.sectionOrder === 1 ? "Self" : c.sectionOrder === 2 ? "Org" : ""}</span></span>
                  <span className="flex gap-3 text-xs">
                    <span>Avg <b className="text-[var(--bets-primary)]">{c.averageScore.toFixed(2)}</b></span>
                    <span>Min <b>{c.minScore?.toFixed(2) ?? "—"}</b></span>
                    <span>Max <b>{c.maxScore?.toFixed(2) ?? "—"}</b></span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per form fill history — one row per SUBMITTED attempt (per user per attempt) — hidden for ADMIN own view */}
      {(!isAdmin || targetUserId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{viewedUser ? `${viewedUser.name}'s Submissions` : "My Submissions"} — per form fill <Badge>{data.personalHistory?.length ?? 0} fills</Badge></CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          {(data.personalHistory?.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--bets-text-muted)]">No submissions yet — start from <Link to="/available" className="text-[var(--bets-primary)] underline">Available</Link>.</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.personalHistory.map((h) => ({ attempt: `Attempt ${h.attempt}`, combined: h.result.overallCombined, self: h.result.overallSelf, org: h.result.overallOrg }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="attempt" tick={{ fontSize: 11, fill: betsColors.textMuted }} />
                    <YAxis domain={[0, 100]} tick={{ fill: betsColors.textMuted }} />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={75} stroke={betsColors.primary} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="combined" stroke={betsColors.primary} strokeWidth={2} dot={{ r: 3 }} name="Combined" />
                    <Line type="monotone" dataKey="self" stroke="#646979" strokeDasharray="4 2" dot={false} name="Self" />
                    <Line type="monotone" dataKey="org" stroke="#5F307D" strokeDasharray="4 2" dot={false} name="Org" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--bets-text-muted)] border-b border-[var(--color-border)]">
                      <th className="py-2">Attempt</th><th>Submitted</th><th>Self Overall</th><th>Self Min</th><th>Self Max</th><th>Org Overall</th><th>Org Min</th><th>Org Max</th><th>Combined</th><th>Global Min</th><th>Global Max</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.personalHistory.map((h) => (
                      <tr key={h.assignmentId} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-2 font-medium text-[var(--bets-text-dark)]">#{h.attempt}</td>
                        <td className="py-2 text-[var(--bets-text-muted)]">{new Date(h.submittedAt).toLocaleString()}</td>
                        <td className="py-2 font-semibold text-[var(--bets-primary)]">{h.result.overallSelf?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.selfMinCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.selfMaxCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2 font-semibold text-[var(--bets-primary)]">{h.result.overallOrg?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.orgMinCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.orgMaxCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2 font-bold text-[var(--bets-text-dark)]">{h.result.overallCombined?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.minCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2">{h.result.maxCategoryScore?.toFixed(2) ?? "—"}</td>
                        <td className="py-2"><Link to={`/results/${h.assignmentId}`} className="text-[var(--bets-primary)] hover:underline">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-[var(--bets-text-muted)] mt-2">Scores are averaged from category results.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
