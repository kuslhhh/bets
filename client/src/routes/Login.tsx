import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState } from "react";

const schema = z.object({ email: z.string().min(3).max(254), password: z.string().min(1) });

export function LoginPage() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      const data = (await apiFetch<{ user: { id: string; name: string; email: string; role: string }; accessToken: string }>("/auth/login", {
        method: "POST",
        body: v,
      })) as { user: { id: string; name: string; email: string; role: string }; accessToken: string };
      const me = (await apiFetch<{ user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string }>(
        "/auth/me",
      )) as { user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string };
      setAuth(me.user, me.role, me.permissions, me.accessToken ?? data.accessToken);
      nav("/available");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (msg.includes("locked")) setErr("Account locked — too many attempts. Try again in 15 minutes.");
      else if (msg.includes("unauthenticated") || msg.includes("401")) setErr("Invalid email or password.");
      else setErr(msg);
    }
  });

  return (
    <div className="max-w-[420px] mx-auto mt-8 lg:mt-12">
      <div className="border border-[var(--color-border)] bg-white">
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)] text-center">
          <img src="/favicon.svg" alt="BETs" className="w-8 h-8 mx-auto object-contain" />
          <h1 className="mt-3 text-[16px] font-bold text-[var(--bets-primary)]">Welcome back</h1>
          <p className="text-[13px] text-[#5a5e6b] mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#1a1d23]">Email</label>
            <Input {...register("email")} placeholder="you@example.com" autoComplete="email" className="mt-1 bg-[#f9fafb]" />
            {formState.errors.email && <p className="text-xs text-red-600 mt-1">{formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#1a1d23]">Password</label>
            <Input type="password" {...register("password")} autoComplete="current-password" placeholder="Enter your password" className="mt-1 bg-[#f9fafb]" />
            {formState.errors.password && <p className="text-xs text-red-600 mt-1">{formState.errors.password.message}</p>}
          </div>
          {err && <p className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{err}</p>}
          <Button type="submit" className="w-full h-10 rounded-[4px] text-[13.5px]">
            Sign in
          </Button>
          <p className="text-[13px] text-center text-[#5a5e6b]">
            No account?{" "}
            <Link to="/" className="font-semibold text-[var(--bets-primary)] hover:text-[var(--bets-primary-dark)] hover:underline underline-offset-4">
              Register
            </Link>
          </p>
        </form>
      </div>
      <p className="text-center text-[11.5px] text-[#6b7280] mt-4">© {new Date().getFullYear()} BETs Consulting</p>
    </div>
  );
}
