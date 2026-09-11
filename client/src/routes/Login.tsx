import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
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
      // hydrate permissions via me
      const me = (await apiFetch<{ user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string }>(
        "/auth/me",
      )) as { user: { id: string; name: string; email: string }; role: string; permissions: string[]; accessToken: string };
      setAuth(me.user, me.role, me.permissions, me.accessToken ?? data.accessToken);
      nav("/available");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      // surface 423 locked distinctly
      if (msg.includes("locked")) setErr("Account locked — too many attempts. Try again in 15 minutes.");
      else if (msg.includes("unauthenticated") || msg.includes("401")) setErr("Invalid email or password.");
      else setErr(msg);
    }
  });

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-[var(--bets-primary)]">Welcome back</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--bets-text)]">Email</label>
              <Input {...register("email")} placeholder="you@example.com" autoComplete="email" />
              {formState.errors.email && <p className="text-sm text-red-600 mt-1">{formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--bets-text)]">Password</label>
              <Input type="password" {...register("password")} autoComplete="current-password" />
              {formState.errors.password && <p className="text-sm text-red-600 mt-1">{formState.errors.password.message}</p>}
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <p className="text-sm text-[var(--bets-text-muted)] text-center">
              No account?{" "}
              <Link to="/register" className="text-[var(--bets-primary)] hover:text-[var(--bets-primary-dark)] font-medium">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
