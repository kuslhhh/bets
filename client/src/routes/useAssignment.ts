// Assignment taking-flow state + data behavior, extracted from Taking.tsx.
// Owns fetching, draft state, debounced autosave, reset and submit.
// Taking.tsx keeps rendering only.
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import type { AssignmentRef, Progress, Question, Section } from "../lib/types";

export function useAssignment() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [assignment, setAssignment] = useState<AssignmentRef | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const requiredTotal = progress?.required ?? questions.filter((q) => q.isRequired && q.type === "SINGLE_SELECT").length;
  // answered reflects actual selections instantly, not just server progress
  const answeredCount = Object.keys(responses).length;
  const pct = requiredTotal ? Math.round((answeredCount / requiredTotal) * 100) : 0;
  const unansweredIds = questions.filter((q) => q.isRequired && q.type === "SINGLE_SELECT" && !responses[q.id]).map((q) => q.id);
  const jumpToNext = () => {
    const nextId = unansweredIds[0];
    if (nextId) document.getElementById(`q-${nextId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleReset = async () => {
    if (!id) return;
    if (!confirm("Clear all answers for this attempt?")) return;
    try {
      const r = await apiFetch<{ progress: Progress }>(`/assignments/${id}/responses`, { method: "DELETE" });
      setResponses({});
      setTextAnswers({});
      setProgress(r.progress);
      dirtyRef.current = false;
      setDirty(false);
      setInfo("Answers cleared");
      setTimeout(() => setInfo(null), 1500);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const data = await apiFetch<{
        assignment: AssignmentRef;
        questions: Question[];
        drafts: { responses: { questionId: string; questionOptionId: string }[]; textAnswers: { questionId: string; slotIndex: number; answerText: string | null }[] };
      }>(`/assignments/${id}`);
      setAssignment(data.assignment);
      const rMap: Record<string, string> = {};
      for (const r of data.drafts.responses) rMap[r.questionId] = r.questionOptionId;
      setResponses(rMap);
      const tMap: Record<string, string> = {};
      for (const t of data.drafts.textAnswers) tMap[`${t.questionId}__${t.slotIndex}`] = t.answerText ?? "";
      setTextAnswers(tMap);
      // fetch sections for correct ordering (S1 → S2) and titles; then sort by section → question order
      let sectionOrderMap = new Map<string, number>();
      try {
        const tree = await apiFetch<{ sections: Section[] }>(`/assessments/${data.assignment.assessmentId}/questions`);
        const sorted = [...tree.sections].sort((a, b) => a.order - b.order);
        setSections(sorted);
        sectionOrderMap = new Map(sorted.map((s) => [s.id, s.order]));
      } catch {
        // fallback: infer from questions' sectionId ordering
        const uniq = [...new Set(data.questions.map((q) => q.sectionId))].sort();
        uniq.forEach((sid, idx) => sectionOrderMap.set(sid, idx + 1));
        setSections(uniq.map((sid, idx) => ({ id: sid, title: `Section ${idx + 1}`, order: idx + 1 })));
      }
      const getSecOrder = (q: Question) => sectionOrderMap.get(q.sectionId) ?? 99;
      const qs = [...data.questions].sort((a, b) => {
        const sa = getSecOrder(a);
        const sb = getSecOrder(b);
        if (sa !== sb) return sa - sb;
        return a.order - b.order;
      });
      setQuestions(qs);
      const answered = data.drafts.responses.length;
      const required = qs.filter((q) => q.isRequired && q.type === "SINGLE_SELECT").length;
      setProgress({ answered, required });
      setDirty(false);
    } catch (e: unknown) {
      setErr(toMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const doSave = useCallback(async (r: Record<string, string>, t: Record<string, string>) => {
    if (!id || !assignment) return;
    setSaving(true);
    setErr(null);
    try {
      const responsesArr = Object.entries(r).map(([questionId, questionOptionId]) => ({ questionId, questionOptionId }));
      const textArr = Object.entries(t).map((k) => {
        const raw = k[0];
        const sep = raw.lastIndexOf("__");
        const questionId = sep >= 0 ? raw.slice(0, sep) : raw;
        const slotIndex = sep >= 0 ? Number(raw.slice(sep + 2)) : 0;
        return { questionId, slotIndex, answerText: k[1] };
      });
      const res = await apiFetch<{ saved: number; progress: Progress }>(`/assignments/${id}/responses`, {
        method: "PUT",
        body: { responses: responsesArr, textAnswers: textArr },
      });
      setProgress(res.progress);
      setDirty(false);
      setInfo(`Saved · ${res.progress.answered}/${res.progress.required} required`);
      setTimeout(() => setInfo(null), 1500);
      dirtyRef.current = false;
    } catch (e: unknown) {
      setErr(toMessage(e));
    } finally {
      setSaving(false);
    }
  }, [id, assignment]);

  // debounced autosave
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void doSave(responses, textAnswers);
    }, 700);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [responses, textAnswers, doSave]);

  const setResponse = (qid: string, oid: string) => {
    setResponses((prev) => ({ ...prev, [qid]: oid }));
    dirtyRef.current = true;
    setDirty(true);
  };
  const setText = (qid: string, idx: number, val: string) => {
    setTextAnswers((prev) => ({ ...prev, [`${qid}__${idx}`]: val }));
    dirtyRef.current = true;
    setDirty(true);
  };

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    setErr(null);
    try {
      // Idempotency-Key for retry safety
      const key = `submit_${id}_${Date.now()}`;
      await apiFetch<{ resultId: string; overallCombined?: number; idempotent?: boolean }>(`/assignments/${id}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": key },
      });
      nav(`/results/${id}`);
    } catch (e: unknown) {
      const msg = toMessage(e);
      if (msg.includes("missing")) setErr("Complete all required questions before submitting.");
      else if (msg.includes("409") || msg.includes("conflict")) setErr("Already submitted or expired.");
      else setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    id,
    dirty,
    assignment,
    questions,
    sections,
    responses,
    textAnswers,
    err,
    info,
    saving,
    progress,
    submitting,
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
  };
}
