import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

const schema = z.object({ email: z.string().min(3).max(254).email() });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: { email: v.email } });
      setDone(true);
    } catch (e) {
      setErr(toMessage(e));
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <p className="text-sm text-[var(--bets-text-muted)]">Enter your email. If an account exists, a reset link will be sent. In dev the link is logged to the server console.</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">If an account exists for that email, a reset link has been sent. Check your email or server logs (dev).</p>
              <Link to="/" className="text-sm text-[var(--bets-primary)] hover:underline">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-[#2b3440]">Email</label>
                <Input {...register("email")} placeholder="you@example.com" autoComplete="email" className="mt-1 bg-white border-[#d9dee6]" />
                {formState.errors.email && <p className="text-xs text-red-600 mt-1">{formState.errors.email.message}</p>}
              </div>
              {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{err}</p>}
              <Button type="submit" className="w-full bg-[var(--bets-primary-dark)]">Send reset link</Button>
              <p className="text-xs text-center text-[var(--bets-text-muted)]">
                <Link to="/" className="text-[var(--bets-primary)] hover:underline">Back to login</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
