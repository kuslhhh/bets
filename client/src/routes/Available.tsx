import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { EXPECTED } from "../lib/bands";
import { ResultDetail, type ResultData } from "../components/ResultDetail";
import type { AssessmentListItem as Assessment } from "../lib/types";

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



function cooldownFromError(e: unknown): CooldownDetails | null {
  if (e instanceof ApiError && e.status === 409 && e.details && typeof e.details === "object") {
    const d = e.details as CooldownDetails;
    if (d.code === "COOLDOWN" || d.nextEligibleAt) return d;
  }
  return null;
}

export function AvailablePage() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<(CooldownDetails & { assessment: Assessment }) | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const nav = useNavigate();

  // Gateway: single PUBLISHED assessment → auto open form,
  // show latest results + countdown inside 45-day gap.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pub, mine] = await Promise.all([
          apiFetch<{ data: Assessment[] }>("/assessments?status=PUBLISHED"),
          apiFetch<{ data: MyRow[] }>("/my-assessments"),
        ]);
        if (cancelled) return;
        const single = pub.data[0] ?? null;
        if (!single) {
          setErr("No assessment available");
          return;
        }
        setAssessment(single);
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

  if (assessment === null && !err && !cooldown) {
    return <p className="text-sm text-[var(--bets-text-muted)]">Opening your assessment…</p>;
  }

  // Cooldown view: submitted → one page with full results (no separate /results needed)
  if (cooldown) {
    const eligibleDate = cooldown.nextEligibleAt ? new Date(cooldown.nextEligibleAt).toLocaleDateString() : "—";
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">{cooldown.assessment.title}</h1>
          <p className="text-sm text-[var(--bets-text-muted)]">Your latest submission — full results on one page. Benchmark {EXPECTED}.</p>
        </div>

        <Card className="overflow-hidden border-[var(--color-border)] shadow-md rounded-xl bg-white">
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--bets-primary)] via-[#9B6EC1] to-[#C4A7E0]" />
          <div className="bg-[#f0faf0]/40 border-b border-[#e0f0e0]">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-[var(--bets-text-dark)]">
                You&apos;ve completed this assessment <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold px-2.5 py-1 text-[11px] tracking-wide">SUBMITTED</Badge>
              </CardTitle>
              <CardDescription className="text-[13px] mt-1">
                Next available on <span className="font-semibold text-[var(--bets-text-dark)]">{eligibleDate}</span>
                {cooldown.daysRemaining != null ? ` — ${cooldown.daysRemaining} days left` : ""}
              </CardDescription>
              {cooldown.daysRemaining != null && (
                <div className="mt-3 h-1.5 rounded-full bg-[#f3e8ff] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#743E95] to-[#9B6EC1] rounded-full transition-all"
                    style={{ width: `${Math.max(4, Math.min(100, ((45 - cooldown.daysRemaining) / 45) * 100))}%` }}
                  />
                </div>
              )}
            </CardHeader>
          </div>
          <CardContent className="space-y-4 pt-4">
            {result ? (
              <ResultDetail data={result} />
            ) : (
              <p className="text-sm text-[var(--bets-text-muted)]">Loading your latest scores…</p>
            )}
            <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
              <button onClick={() => window.print()} className="text-sm text-[var(--bets-text-muted)] underline px-2 rounded-full">Print</button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (starting) return <p className="text-sm text-[var(--bets-text-muted)]">Opening your assessment…</p>;

  if (assessment) {
    return (
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">{assessment.title}</h1>
        <p className="text-sm text-[var(--bets-text-muted)]">Single assessment — opening automatically.</p>
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{assessment.title} <Badge>{assessment.status}</Badge></CardTitle>
            {assessment.description && <CardDescription>{assessment.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                try {
                  const r = await apiFetch<{ assignment: { id: string } }>(`/assessments/${assessment.id}/start`, { method: "POST" });
                  nav(`/assignments/${r.assignment.id}`);
                } catch (e: unknown) {
                  setErr(toMessage(e));
                }
              }}
            >
              Start
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Assessment</h1>
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      <p className="text-sm text-[var(--bets-text-muted)]">No published assessment available.</p>
    </div>
  );
}
