import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import type { AssessmentListItem as Assessment, AssessmentDetail } from "../lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export function AssessmentsPage() {
  const [data, setData] = useState<Assessment | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Assessment[] }>("/assessments")
      .then((r) => setData(r.data[0] ?? null))
      .catch((e: unknown) => setErr(toMessage(e)));
  }, []);

  if (err) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{err}</p>;
  if (!data) return <p className="text-sm text-[var(--bets-text-muted)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Assessment</h1>
      <p className="text-sm text-[var(--bets-text-muted)]">Single assessment — managed by system. No creation needed.</p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {data.title}
            <Badge className={data.status === "PUBLISHED" ? "bg-[var(--bets-primary)] text-white" : "bg-[#f5eefb] text-[var(--bets-primary)]"}>{data.status}</Badge>
          </CardTitle>
          {data.description && <CardDescription>{data.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Link to={`/admin/assessments/${data.id}`} className="text-sm text-[var(--bets-primary)] hover:underline">View structure →</Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function AssessmentDetailPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<{ assessment: AssessmentDetail } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ assessment: AssessmentDetail }>(`/assessments/${id}`)
      .then((r) => setData(r))
      .catch((e: unknown) => setErr(toMessage(e)));
  }, [id]);

  if (err) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{err}</p>;
  if (!data) return <p className="text-sm text-[var(--bets-text-muted)]">Loading…</p>;
  const a = data.assessment;
  return (
    <div className="space-y-4">
      {a.description && <p className="text-sm text-[var(--bets-text-muted)]">{a.description}</p>}
      {a.sections.map((s) => (
        <Card key={s.id}>
          <CardHeader><CardTitle className="text-base">{s.order}. {s.title}</CardTitle><CardDescription>{s.categories.map((c) => c.name).join(" · ")}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {s.questions.map((q) => (
              <div key={q.id} className="border border-[var(--color-border)] rounded-lg p-3">
                <p className="text-sm font-medium text-[var(--bets-text)]">{q.order}. {q.promptText}</p>
                {q.type === "SINGLE_SELECT" && (
                  <ul className="mt-2 space-y-1">
                    {q.options.map((o) => (
                      <li key={o.id} className="text-sm text-[var(--bets-text-muted)]"><span className="font-semibold text-[var(--bets-primary)]">{o.label}.</span> {o.optionText}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Link to="/admin/assessments" className="text-sm text-[var(--bets-primary)]">← Back</Link>
    </div>
  );
}
