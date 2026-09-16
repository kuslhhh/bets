import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import type { AssessmentListItem as Assessment, CategoryScore } from "../lib/types";

interface MyRow {
  id: string;
  status: string;
  assessmentId: string;
  submittedAt?: string | null;
  assessment: { id: string; title: string; status: string };
}

interface Eligibility {
  eligible: boolean;
  hasActive?: boolean;
  assignmentId?: string | null;
  status?: string;
  nextEligibleAt?: string | null;
  daysRemaining?: number;
  latestAssignmentId?: string | null;
}

interface CooldownDetails {
  code?: string;
  nextEligibleAt?: string;
  daysRemaining?: number;
  latestAssignmentId?: string;
}

interface ResultData {
  result: { overallSelf: number | null; overallOrg: number | null; overallCombined: number | null };
  categories: CategoryScore[];
}

function cooldownFromError(e: unknown): CooldownDetails | null {
  if (e instanceof ApiError && e.status === 409 && e.details && typeof e.details === "object") {
    const d = e.details as CooldownDetails;
    if (d.code === "COOLDOWN" || d.nextEligibleAt) return d;
  }
  return null;
}

export function AvailablePage() {
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<(CooldownDetails & { assessment: Assessment }) | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const nav = useNavigate();

  const start = async (id: string) => {
    try {
      const r = await apiFetch<{ assignment: { id: string } }>(`/assessments/${id}/start`, { method: "POST" });
      nav(`/assignments/${r.assignment.id}`);
    } catch (e: unknown) {
      const cd = cooldownFromError(e);
      if (cd) {
        const a = assessments?.find((x) => x.id === id);
        if (a) {
          setCooldown({ ...cd, assessment: a });
          return;
        }
      }
      setErr(toMessage(e));
    }
  };

  // Gateway: single PUBLISHED assessment → directly open the form,
  // show latest results + countdown inside the 45-day gap.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pub, mine] = await Promise.all([
          apiFetch<{ data: Assessment[] }>("/assessments?status=PUBLISHED"),
          apiFetch<{ data: MyRow[] }>("/my-assessments"),
        ]);
        if (cancelled) return;
        setAssessments(pub.data);
        if (pub.data.length !== 1) return;
        const single = pub.data[0];
        const rows = mine.data.filter((r) => r.assessmentId === single.id || r.assessment?.id === single.id);
        const active = rows.find((r) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS");
        if (active) {
          nav(`/assignments/${active.id}`, { replace: true });
          return;
        }
        const elig = await apiFetch<Eligibility>(`/assessments/${single.id}/eligibility`).catch(() => null);
        if (cancelled) return;
        if (elig?.hasActive && elig.assignmentId) {
          nav(`/assignments/${elig.assignmentId}`, { replace: true });
          return;
        }
        if (elig && !elig.eligible) {
          setCooldown({
            code: "COOLDOWN",
            nextEligibleAt: elig.nextEligibleAt ?? undefined,
            daysRemaining: elig.daysRemaining,
            latestAssignmentId: elig.latestAssignmentId ?? undefined,
            assessment: single,
          });
          return;
        }
        if (startedRef.current) return;
        startedRef.current = true;
        setStarting(true);
        try {
          const r = await apiFetch<{ assignment: { id: string } }>(`/assessments/${single.id}/start`, { method: "POST" });
          if (!cancelled) nav(`/assignments/${r.assignment.id}`, { replace: true });
        } catch (e: unknown) {
          if (cancelled) return;
          const cd = cooldownFromError(e);
          if (cd) setCooldown({ ...cd, assessment: single });
          else setErr(toMessage(e));
        } finally {
          if (!cancelled) setStarting(false);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(toMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  // Load latest results for the cooldown view
  useEffect(() => {
    if (!cooldown?.latestAssignmentId) return;
    let cancelled = false;
    apiFetch<ResultData>(`/results/${cooldown.latestAssignmentId}`)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cooldown?.latestAssignmentId]);

  if (assessments === null && !err && !cooldown) {
    return <p className="text-sm text-[var(--bets-text-muted)]">Opening your assessment…</p>;
  }

  // Cooldown view: submitted → show their results + gap countdown
  if (cooldown) {
    const eligibleDate = cooldown.nextEligibleAt ? new Date(cooldown.nextEligibleAt).toLocaleDateString() : "—";
    return (
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">{cooldown.assessment.title}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              You&apos;ve completed this assessment <Badge className="bg-[#f0faf0] text-[#1a7f37]">SUBMITTED</Badge>
            </CardTitle>
            <CardDescription>
              You can fill the next form after the 45-day gap —{" "}
              {cooldown.daysRemaining != null ? (
                <span className="font-semibold text-[var(--bets-text)]">
                  {cooldown.daysRemaining} day{cooldown.daysRemaining === 1 ? "" : "s"} remaining (eligible {eligibleDate})
                </span>
              ) : (
                <span>eligible {eligibleDate}</span>
              )}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result ? (
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[#fcf9ff]">
                  <p className="text-xs text-[var(--bets-text-muted)]">Overall Self</p>
                  <p className="text-lg font-bold text-[var(--bets-primary)]">{result.result.overallSelf?.toFixed(2) ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[#fcf9ff]">
                  <p className="text-xs text-[var(--bets-text-muted)]">Overall Org</p>
                  <p className="text-lg font-bold text-[var(--bets-primary)]">{result.result.overallOrg?.toFixed(2) ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3">
                  <p className="text-xs text-[var(--bets-text-muted)]">Combined</p>
                  <p className="text-lg font-bold text-[var(--bets-text-dark)]">{result.result.overallCombined?.toFixed(2) ?? "—"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--bets-text-muted)]">Loading your latest scores…</p>
            )}
            <div className="flex gap-2">
              {cooldown.latestAssignmentId && (
                <Link to={`/results/${cooldown.latestAssignmentId}`}>
                  <Button size="sm">View full results</Button>
                </Link>
              )}
              <Link to="/my-assessments">
                <Button variant="secondary" size="sm">My Assessments</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (starting) return <p className="text-sm text-[var(--bets-text-muted)]">Opening your assessment…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Available Assessments</h1>
      <p className="text-sm text-[var(--bets-text-muted)]">PUBLISHED assessments you can start — self-serve, no admin assignment needed.</p>
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {(assessments ?? []).map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {a.title} <Badge>{a.status}</Badge>
              </CardTitle>
              {a.description && <CardDescription>{a.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <Button onClick={() => start(a.id)}>Start</Button>
            </CardContent>
          </Card>
        ))}
        {assessments?.length === 0 && !err && <p className="text-sm text-[var(--bets-text-muted)]">No published assessments yet.</p>}
      </div>
    </div>
  );
}
