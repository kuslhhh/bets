import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { ResultDetail, type ResultData } from "../components/ResultDetail";

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<ResultData>(`/results/${id}`)
      .then(setData)
      .catch((e: unknown) => setErr(toMessage(e)));
  }, [id]);

  if (err) return <div className="p-8 text-red-600 bg-red-50 border border-red-200 rounded-md">{err} <Link to="/available" className="underline text-[var(--bets-primary)]">Back</Link></div>;
  if (!data) return <div className="p-8 text-[var(--bets-text-muted)]">Loading results…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--bets-text-dark)]">Results</h1>
        <Link to="/available" className="text-sm text-[var(--bets-primary)] hover:underline">← Back to Available (one page)</Link>
      </div>
      <ResultDetail data={data} />
      <div className="flex gap-4">
        <Link to="/available" className="text-sm text-[var(--bets-primary)] hover:text-[var(--bets-primary-dark)]">← Assessment</Link>
        <button onClick={() => window.print()} className="text-sm text-[var(--bets-text-muted)] underline">Print</button>
      </div>
      <p className="text-xs text-[var(--bets-text-muted)]">Tip: this view also appears on <Link to="/available" className="text-[var(--bets-primary)] underline">/available</Link>.</p>
    </div>
  );
}
