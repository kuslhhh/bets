import { Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAssignment } from "./useAssignment";

export function TakingPage() {
  const {
    id,
    assignment,
    questions,
    sections,
    responses,
    textAnswers,
    err,
    info,
    saving,
    submitting,
    dirty,
    requiredTotal,
    answeredCount,
    pct,
    unansweredIds,
    setResponse,
    setText,
    doSave,
    handleReset,
    handleSubmit,
    jumpToNext,
  } = useAssignment();
  const nav = useNavigate();

  if (!id) return <div className="p-8 text-[var(--bets-text-muted)]">Missing assignment id</div>;
  if (!assignment && !err) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (err && !assignment) return <div className="p-8 text-red-600 bg-red-50 border border-red-200 rounded-md">{err} <Link to="/my-assessments" className="underline text-[var(--bets-primary)]">Back</Link></div>;

  const s1 = sections[0]?.title ?? "Section 1: About self";
  const s2 = sections[1]?.title ?? "Section 2: About organisation";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--bets-text-dark)]">{assignment?.assessment.title ?? "Assessment"}</h1>
        <Badge className="bg-[#f5eefb] text-[var(--bets-primary)]">{assignment?.status}</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--bets-text-muted)]">
              Progress {answeredCount}/{requiredTotal} required {pct === 0 ? "— no selections yet" : pct === 100 ? "— complete" : `— ${unansweredIds.length} remaining`}
            </span>
            <span className="text-[var(--bets-primary)] font-medium">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#f0e8f7] overflow-hidden">
            <div className="h-full bg-[var(--bets-primary)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-2 mt-3 text-xs flex-wrap items-center">
            <span className="px-2 py-1 rounded bg-[var(--bets-primary)] text-white">{s1}</span>
            <span className="px-2 py-1 rounded bg-white border border-[var(--color-border)] text-[var(--bets-text-muted)]">{s2}</span>
            <span className="ml-auto flex gap-2">
              {unansweredIds.length > 0 && (
                <button onClick={jumpToNext} className="px-2 py-1 rounded border bg-white text-[var(--bets-primary)] border-[var(--bets-primary)] hover:bg-[#f5eefb] text-xs">
                  Next unanswered →
                </button>
              )}
              <button onClick={handleReset} className="px-2 py-1 rounded border bg-white text-red-600 border-red-200 hover:bg-red-50 text-xs">
                Reset
              </button>
            </span>
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      {info && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">{info}</p>}

      <div className="space-y-6">
        {(() => {
          // group by section for persistence verification: S1 (first 8) then S2 (next 8)
          let lastSec: string | null = null;
          return questions.map((q, idx) => {
            const secId = q.sectionId;
            const sec = sections.find((s) => s.id === secId);
            const showHeader = secId !== lastSec;
            if (showHeader) lastSec = secId;
            return (
              <div key={q.id} className="space-y-3">
                {showHeader && sec && (
                  <h2 className="text-sm font-semibold text-[var(--bets-primary)] border-l-4 border-[var(--bets-primary)] pl-3 py-1 bg-[#f8f5fc] rounded-r">
                    {sec.title}
                  </h2>
                )}
                <Card id={`q-${q.id}`} className={q.isRequired && q.type === "SINGLE_SELECT" && !responses[q.id] ? "ring-1 ring-amber-200 border-amber-200" : ""}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-[var(--bets-text)] flex gap-2">
                      <span className="text-[var(--bets-primary)] font-bold">{idx + 1}.</span> {q.promptText} {q.isRequired && <span className="text-red-500">*</span>}
                      <span className="ml-auto flex items-center gap-2 text-xs font-normal">
                        {q.isRequired && q.type === "SINGLE_SELECT" ? (
                          responses[q.id] ? <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Answered</span> : <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Required</span>
                        ) : null}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {q.type === "SINGLE_SELECT" ? (
                      <div className="space-y-2">
                        {q.options.map((o) => {
                          const checked = responses[q.id] === o.id;
                          return (
                            <label
                              key={o.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-[#f5eefb] border-[var(--bets-primary)]" : "bg-white border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[#f8f5fc]"}`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={checked}
                                onChange={() => setResponse(q.id, o.id)}
                                className="mt-1 accent-[var(--bets-primary)]"
                              />
                              <span className={`text-sm ${checked ? "text-[var(--bets-text-dark)] font-medium" : "text-[var(--bets-text)]"}`}>
                                <span className="font-semibold mr-1">{o.label}.</span> {o.optionText}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {Array.from({ length: q.slotCount ?? 4 }).map((_, si) => (
                          <div key={si}>
                            <label className="text-xs text-[var(--bets-text-muted)]">Answer {String.fromCharCode(97 + si)}.</label>
                            <textarea
                              value={textAnswers[`${q.id}__${si}`] ?? ""}
                              onChange={(e) => setText(q.id, si, e.target.value)}
                              rows={2}
                              maxLength={5000}
                              placeholder="Your answer (optional)"
                              className="w-full mt-1 rounded-md border bg-white px-3 py-2 text-sm text-[var(--bets-text)] border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--bets-primary)] focus:border-[var(--bets-primary)]"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          });
        })()}
      </div>

      <div className="flex items-center gap-3 sticky bottom-4 bg-white/90 backdrop-blur border border-[var(--color-border)] rounded-lg p-3 shadow-sm">
        <Button variant="secondary" onClick={() => void doSave(responses, textAnswers)} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <span className="text-xs text-[var(--bets-text-muted)]">{saving ? "Saving draft…" : dirty ? "Unsaved changes" : "Draft autosaves"}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => nav("/my-assessments")}>Back</Button>
          <Button onClick={handleSubmit} disabled={submitting || pct < 100}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-[var(--bets-text-muted)] text-center">Answer all required questions to submit.</p>
    </div>
  );
}
