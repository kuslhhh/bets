import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { AssessmentListItem as Assessment } from "../lib/types";

export function AvailablePage() {
  const [data, setData] = useState<Assessment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    apiFetch<{ data: Assessment[] }>("/assessments?status=PUBLISHED")
      .then((r) => setData(r.data))
      .catch((e: unknown) => setErr(toMessage(e)));
  }, []);

  const start = async (id: string) => {
    try {
      const r = (await apiFetch<{ assignment: { id: string } }>(`/assessments/${id}/start`, { method: "POST" })) as {
        assignment: { id: string };
      };
      nav(`/assignments/${r.assignment.id}`);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Available Assessments</h1>
      <p className="text-sm text-[var(--bets-text-muted)]">PUBLISHED assessments you can start — self-serve, no admin assignment needed.</p>
      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((a) => (
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
        {data.length === 0 && !err && <p className="text-sm text-[var(--bets-text-muted)]">No published assessments yet.</p>}
      </div>
    </div>
  );
}
