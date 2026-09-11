import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useState } from "react";

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "must contain uppercase")
    .regex(/[a-z]/, "must contain lowercase")
    .regex(/[0-9]/, "must contain digit"),
});

export function RegisterPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await apiFetch("/auth/register", { method: "POST", body: v });
      setOk(true);
      setTimeout(() => nav("/login"), 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.includes("conflict") || msg.includes("409")) setErr("Email already exists.");
      else setErr(msg);
    }
  });

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-[var(--bets-primary)]">Create account</CardTitle>
          <CardDescription>Self-registration — you will be a USER</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--bets-text)]">Name</label>
              <Input {...register("name")} placeholder="Your name" />
              {formState.errors.name && <p className="text-sm text-red-600 mt-1">{formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--bets-text)]">Email</label>
              <Input {...register("email")} placeholder="you@example.com" />
              {formState.errors.email && <p className="text-sm text-red-600 mt-1">{formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--bets-text)]">Password</label>
              <Input type="password" {...register("password")} placeholder="At least 8 chars, upper/lower/digit" />
              {formState.errors.password && <p className="text-sm text-red-600 mt-1">{formState.errors.password.message}</p>}
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
            {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">Registered — redirecting to login…</p>}
            <Button type="submit" className="w-full">
              Register
            </Button>
            <p className="text-sm text-[var(--bets-text-muted)] text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-[var(--bets-primary)] font-medium hover:text-[var(--bets-primary-dark)]">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
