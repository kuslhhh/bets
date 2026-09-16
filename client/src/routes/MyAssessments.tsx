import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

type Row = {
  id: string;
  status: string;
  assessment: { id: string; title: string; status: string };
  progress: { answered: number; required: number };
};

export function MyAssessmentsPage() {
  const [data, setData] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Row[] }>("/my-assessments")
      .then((r) => setData(r.data))
      .catch((e: unknown) => setErr(toMessage(e)));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">My Assessments</h1>
      <p className="text-sm text-[var(--bets-text-muted)]">Your in-progress and submitted assignments.</p>
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      <div className="grid gap-3">
        {data.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {r.assessment.title}
                <Badge className={r.status === "SUBMITTED" ? "bg-[#f0faf0] text-[#1a7f37]" : "bg-[#f5eefb] text-[var(--bets-primary)]"}>
                  {r.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[var(--bets-text-muted)]">
                Progress {r.progress.answered}/{r.progress.required}
              </p>
              <div className="h-2 rounded-full bg-[#f0e8f7] overflow-hidden">
                <div
                  className="h-full bg-[var(--bets-primary)] transition-all"
                  style={{ width: `${r.progress.required ? (r.progress.answered / r.progress.required) * 100 : 0}%` }}
                />
              </div>
              <div className="flex gap-2">
                {r.status !== "SUBMITTED" ? (
                  <Link to={`/assignments/${r.id}`}>
                    <Button size="sm">{r.status === "IN_PROGRESS" ? "Resume" : "Continue"}</Button>
                  </Link>
                ) : (
                  <Link to={`/results/${r.id}`}>
                    <Button variant="secondary" size="sm">View Results</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && !err && <p className="text-sm text-[var(--bets-text-muted)]">No assignments yet — start one from Available.</p>}
      </div>
    </div>
  );
}
