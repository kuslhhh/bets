import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import type { AssessmentListItem as Assessment, AssessmentDetail } from "../lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createSchema = z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).optional(), cloneTemplate: z.boolean().optional() });

export function AssessmentsPage() {
  const [data, setData] = useState<Assessment[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const qs = filter ? `?status=${filter}` : "";
      const r = (await apiFetch<{ data: Assessment[] }>(`/assessments${qs}`)) as { data: Assessment[] };
      setData(r.data);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  };

  useEffect(() => { void fetchAll(); }, [filter]);

  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { cloneTemplate: true } });

  const onCreate = handleSubmit(async (v) => {
    try {
      await apiFetch("/assessments", { method: "POST", body: v });
      setInfo("Assessment created");
      reset({ title: "", description: "", cloneTemplate: true });
      void fetchAll();
      setTimeout(() => setInfo(null), 1500);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  });

  const doAction = async (id: string, action: "publish" | "close" | "archive") => {
    try {
      await apiFetch(`/assessments/${id}/${action}`, { method: "POST" });
      setInfo(`${action} ok`);
      void fetchAll();
    } catch (e: unknown) {
      const msg = toMessage(e);
      if (msg.includes("409")) setErr(`This action is not allowed — the assessment is missing required content or is already published.`);
      else setErr(msg);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Assessments</h1>

      <div className="flex gap-2 items-center">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm border-[var(--color-border-strong)]">
          <option value="">All</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <span className="text-sm text-[var(--bets-text-muted)]">{data.length} items</span>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      {info && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">{info}</p>}

      <div className="grid gap-3">
        {data.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link to={`/assessments/${a.id}`} className="hover:underline text-[var(--bets-primary)]">{a.title}</Link>
                <Badge className={a.status === "PUBLISHED" ? "bg-[var(--bets-primary)] text-white" : a.status === "DRAFT" ? "bg-[#f5eefb] text-[var(--bets-primary)]" : "bg-gray-100 text-gray-600"}>{a.status}</Badge>
              </CardTitle>
              {a.description && <CardDescription>{a.description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              {a.status === "DRAFT" && <Button size="sm" onClick={() => doAction(a.id, "publish")}>Publish</Button>}
              {a.status === "PUBLISHED" && <Button size="sm" variant="secondary" onClick={() => doAction(a.id, "close")}>Close</Button>}
              <Button size="sm" variant="ghost" onClick={() => doAction(a.id, "archive")}>Archive</Button>
              <Link to={`/assessments/${a.id}`}><Button size="sm" variant="ghost">View tree</Button></Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-[var(--bets-primary)]">Create assessment</CardTitle><CardDescription>New assessments start as Draft. Enable “Clone template” to include the standard questions.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3 max-w-lg">
            <div><label className="text-xs text-[var(--bets-text)]">Title</label><Input {...register("title")} placeholder="Financial Maturity Assessment" /><p className="text-xs text-red-600">{formState.errors.title?.message}</p></div>
            <div><label className="text-xs text-[var(--bets-text)]">Description</label><Input {...register("description")} placeholder="Optional" /></div>
            <label className="flex items-center gap-2 text-sm text-[var(--bets-text)]"><input type="checkbox" {...register("cloneTemplate")} /> Clone template (standard questions)</label>
            <Button type="submit">Create</Button>
          </form>
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
  const isPublished = a.status === "PUBLISHED";
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[var(--bets-text-dark)] flex items-center gap-2">{a.title} <Badge>{a.status}</Badge> {isPublished && <Badge className="bg-amber-50 text-amber-700 border-amber-200">Published — content locked</Badge>}</h1>
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
      <Link to="/assessments" className="text-sm text-[var(--bets-primary)]">← Back</Link>
    </div>
  );
}
