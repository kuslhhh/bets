import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

const schema = z.object({
  newPassword: z.string().min(8).regex(/[A-Z]/, "must contain uppercase").regex(/[a-z]/, "must contain lowercase").regex(/[0-9]/, "must contain digit"),
  confirm: z.string().min(1),
}).refine((v) => v.newPassword === v.confirm, { message: "passwords do not match", path: ["confirm"] });

type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") ?? "";
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    if (!token) { setErr("Missing token — use the link from your email."); return; }
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, newPassword: v.newPassword } });
      setOk(true);
      setTimeout(() => nav("/"), 1200);
    } catch (e) {
      setErr(toMessage(e));
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <p className="text-sm text-[var(--bets-text-muted)]">{token ? "Enter your new password." : "Invalid or missing token."}</p>
        </CardHeader>
        <CardContent>
          {ok ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">Password reset — redirecting to login…</p>
              <Link to="/" className="text-sm text-[var(--bets-primary)] hover:underline">Go to login</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-[#2b3440]">New password</label>
                <Input type="password" {...register("newPassword")} placeholder="New password" autoComplete="new-password" className="mt-1 bg-white border-[#d9dee6]" />
                {formState.errors.newPassword && <p className="text-xs text-red-600 mt-1">{formState.errors.newPassword.message}</p>}
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#2b3440]">Confirm password</label>
                <Input type="password" {...register("confirm")} placeholder="Confirm password" autoComplete="new-password" className="mt-1 bg-white border-[#d9dee6]" />
                {formState.errors.confirm && <p className="text-xs text-red-600 mt-1">{formState.errors.confirm.message}</p>}
              </div>
              {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{err}</p>}
              <Button type="submit" className="w-full bg-[var(--bets-primary-dark)]" disabled={!token}>Reset password</Button>
              <p className="text-xs text-center text-[var(--bets-text-muted)]">
                <Link to="/forgot-password" className="text-[var(--bets-primary)] hover:underline">Request new link</Link> · <Link to="/" className="text-[var(--bets-primary)] hover:underline">Back to login</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
