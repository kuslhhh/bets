import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { toMessage } from "../lib/errors";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UserRow } from "../lib/types";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  roleCode: z.string().min(1),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});

export function UsersPage() {
  const [data, setData] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchUsers = async (p = 1) => {
    setErr(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(p));
      qs.set("pageSize", "20");
      if (q) qs.set("q", q);
      if (role) qs.set("role", role);
      if (isActive) qs.set("isActive", isActive);
      const res = (await apiFetch<{ data: UserRow[]; total: number; page: number }>(`/users?${qs}`)) as { data: UserRow[]; total: number; page: number };
      setData(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (e: unknown) {
      const msg = toMessage(e);
      setErr(msg);
    }
  };

  useEffect(() => {
    void fetchUsers(1);
  }, []);

  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema), defaultValues: { roleCode: "USER" } });

  const onCreate = handleSubmit(async (v) => {
    try {
      await apiFetch("/users", { method: "POST", body: v });
      setInfo("User created");
      reset();
      void fetchUsers(page);
      setTimeout(() => setInfo(null), 1500);
    } catch (e: unknown) {
      const msg = toMessage(e);
      setErr(msg);
    }
  });

  const patchRole = async (id: string, roleCode: string) => {
    try {
      await apiFetch(`/users/${id}/role`, { method: "PATCH", body: { roleCode } });
      setInfo(`Role changed to ${roleCode}`);
      void fetchUsers(page);
    } catch (e: unknown) {
      const msg = toMessage(e);
      if (msg.includes("409")) setErr("You cannot change your own role.");
      else setErr(msg);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      await apiFetch(`/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } });
      void fetchUsers(page);
    } catch (e: unknown) {
      const msg = toMessage(e);
      if (msg.includes("409")) setErr("You cannot deactivate your own account.");
      else setErr(msg);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this user? Users with submissions will be archived as Inactive instead.")) return;
    try {
      const res = (await apiFetch<{ ok: boolean; deactivated?: boolean }>(`/users/${id}`, { method: "DELETE" })) as { ok: boolean; deactivated?: boolean };
      if (res.deactivated) {
        setInfo("User archived as Inactive — they have existing submissions.");
      } else {
        setInfo("User deleted.");
      }
      void fetchUsers(page);
      setTimeout(() => setInfo(null), 2500);
    } catch (e: unknown) {
      const msg = toMessage(e);
      if (msg.includes("409")) setErr("You cannot delete your own account.");
      else setErr(msg);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--bets-text-dark)]">Users</h1>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-[var(--bets-text-muted)]">Search</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name or email" className="w-48" />
          </div>
          <div>
            <label className="text-xs text-[var(--bets-text-muted)]">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm border-[var(--color-border-strong)]">
              <option value="">All</option>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--bets-text-muted)]">Active</label>
            <select value={isActive} onChange={(e) => setIsActive(e.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm border-[var(--color-border-strong)]">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => fetchUsers(1)}>Filter</Button>
          <span className="text-sm text-[var(--bets-text-muted)]">{total} total · page {page}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => fetchUsers(Math.max(1, page - 1))} disabled={page <= 1}>Prev</Button>
            <Button variant="ghost" size="sm" onClick={() => fetchUsers(page + 1)} disabled={data.length < 20}>Next</Button>
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{err}</p>}
      {info && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">{info}</p>}

      <p className="text-xs text-[var(--bets-text-muted)]">Users with submissions are archived as Inactive when deleted and can be reactivated.</p>

      <Card>
        <CardHeader><CardTitle>All users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--bets-text-muted)] border-b border-[var(--color-border)]">
                  <th className="py-2">Name</th><th className="py-2">Email</th><th className="py-2">Role</th><th className="py-2">Active</th><th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#fcf9ff]">
                    <td className="py-2 text-[var(--bets-text)]">
                      <Link to={`/admin/users/${u.id}`} className="font-medium text-[var(--bets-primary)] hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="py-2 text-[var(--bets-text-muted)]">{u.email}</td>
                    <td className="py-2"><Badge className={u.role.code === "ADMIN" ? "bg-[var(--bets-primary)] text-white" : "bg-[#f5eefb] text-[var(--bets-primary)]"}>{u.role.code}</Badge></td>
                    <td className="py-2">
                      {u.isActive ? <span className="text-green-700">Active</span> : <span className="text-red-600">Inactive</span>}
                    </td>
                    <td className="py-2 flex gap-1 flex-wrap">
                      <Link to={`/admin/users/${u.id}`}>
                        <Button size="sm" variant="secondary">View</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => patchRole(u.id, u.role.code === "ADMIN" ? "USER" : "ADMIN")}>Change role</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>{u.isActive ? "Deactivate" : "Activate"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(u.id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-[var(--bets-primary)]">Create user (ADMIN)</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-3">
            <div><label className="text-xs text-[var(--bets-text)]">Name</label><Input {...register("name")} /><p className="text-xs text-red-600">{formState.errors.name?.message}</p></div>
            <div><label className="text-xs text-[var(--bets-text)]">Email</label><Input {...register("email")} /><p className="text-xs text-red-600">{formState.errors.email?.message}</p></div>
            <div><label className="text-xs text-[var(--bets-text)]">Role</label>
              <select {...register("roleCode")} className="h-9 w-full rounded-md border bg-white px-3 text-sm border-[var(--color-border-strong)]">
                <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div><label className="text-xs text-[var(--bets-text)]">Password (8+ upper/lower/digit)</label><Input type="password" {...register("password")} /><p className="text-xs text-red-600">{formState.errors.password?.message}</p></div>
            <div className="md:col-span-2"><Button type="submit">Create</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
