import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "current password required"),
  newPassword: z.string().min(8).regex(/[A-Z]/, "must contain uppercase").regex(/[a-z]/, "must contain lowercase").regex(/[0-9]/, "must contain digit"),
  confirm: z.string().min(1),
}).refine((v) => v.newPassword === v.confirm, { message: "passwords do not match", path: ["confirm"] });

type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user } = useAuth();
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { register, handleSubmit, formState, reset, watch } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });
  const newPw = watch("newPassword") ?? "";

  const strength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[a-z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    return Math.min(s, 4);
  })();

  const onChangePassword = handleSubmit(async (v) => {
    setOk(null); setErr(null);
    try {
      await apiFetch("/account/password", { method: "POST", body: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
      setOk("Password updated successfully.");
      reset();
    } catch (e) {
      setErr(toMessage(e));
    }
  });

  const initials = (user?.name?.trim()?.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || user?.email?.[0]?.toUpperCase() || "U");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Profile</h1>
        <p className="text-sm text-[var(--bets-text-muted)]">Manage your account and security.</p>
      </div>

      <Card className="overflow-hidden shadow-sm rounded-xl border-[var(--color-border)]">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--bets-primary)] via-[#9B6EC1] to-[#C4A7E0]" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--bets-primary)] to-[#9B6EC1] text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--bets-text-dark)] truncate">{user?.name ?? "—"}</p>
              <p className="text-sm text-[var(--bets-text-muted)] truncate">{user?.email ?? "—"}</p>
            </div>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[#fcf9ff] px-3.5 py-3">
              <p className="text-[11px] tracking-wide uppercase font-semibold text-[var(--bets-text-muted)]">Name</p>
              <p className="text-sm font-medium text-[var(--bets-text)] mt-1 truncate">{user?.name ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-3">
              <p className="text-[11px] tracking-wide uppercase font-semibold text-[var(--bets-text-muted)]">Email</p>
              <p className="text-sm font-medium text-[var(--bets-text)] mt-1 truncate">{user?.email ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm rounded-xl border-[var(--color-border)] bg-gradient-to-br from-white to-[#fcf9ff]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#2b3440]">Current password</label>
              <Input type="password" {...register("currentPassword")} placeholder="Current password" autoComplete="current-password" className="mt-1.5 bg-white border-[#d9dee6] focus-visible:ring-[var(--bets-primary)]" />
              {formState.errors.currentPassword && <p className="text-xs text-red-600 mt-1">{formState.errors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#2b3440]">New password</label>
              <Input type="password" {...register("newPassword")} placeholder="New password" autoComplete="new-password" className="mt-1.5 bg-white border-[#d9dee6] focus-visible:ring-[var(--bets-primary)]" />
              {newPw && (
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-1.5 flex-1 rounded-full bg-[#eee] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${i <= strength ? (strength <= 2 ? "bg-amber-500" : strength === 3 ? "bg-[#9B6EC1]" : "bg-emerald-500") : "bg-transparent"}`} />
                    </div>
                  ))}
                </div>
              )}
              {formState.errors.newPassword && <p className="text-xs text-red-600 mt-1">{formState.errors.newPassword.message}</p>}
              <p className="text-[11px] text-[var(--bets-text-muted)] mt-1">At least 8 chars, with uppercase, lowercase & digit.</p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#2b3440]">Confirm new password</label>
              <Input type="password" {...register("confirm")} placeholder="Confirm" autoComplete="new-password" className="mt-1.5 bg-white border-[#d9dee6] focus-visible:ring-[var(--bets-primary)]" />
              {formState.errors.confirm && <p className="text-xs text-red-600 mt-1">{formState.errors.confirm.message}</p>}
            </div>
            {ok && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">{ok}</p>}
            {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{err}</p>}
            <Button type="submit" className="w-full h-10 rounded-lg bg-[var(--bets-primary-dark)] hover:bg-[var(--bets-primary)]">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
