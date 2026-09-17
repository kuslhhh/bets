import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full text-[13.5px] font-medium transition-colors ${isActive ? "bg-[#f5eefb] text-[var(--bets-primary)]" : "text-[var(--bets-text-muted)] hover:text-[var(--bets-text-dark)] hover:bg-[#f8f8f9]"}`
      }
    >
      {label}
    </NavLink>
  );
}

export function Layout() {
  const { user, role, hasPermission, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = hasPermission("users.view") || role === "ADMIN";

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-[56px]">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="BEtS" className="h-7 w-auto object-contain" />
            <span className="font-bold text-[var(--bets-primary)] text-[15px] tracking-tight">BEtS Consulting</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-1 mr-1">
                  {!isAdmin && <NavItem to="/available" label="Assessment" />}
                  {isAdmin && (
                    <>
                      <NavItem to="/admin/dashboard" label="Dashboard" />
                      <NavItem to="/admin/users" label="Users" />
                      <NavItem to="/admin/assessments" label="Assessment" />
                      <NavItem to="/admin/reports" label="Reports" />
                    </>
                  )}
                  <NavItem to="/profile" label="Profile" />
                </div>
                {/* mobile fallback */}
                <div className="flex sm:hidden items-center gap-1">
                  {!isAdmin && <NavItem to="/available" label="Assessment" />}
                  <NavItem to="/profile" label="Profile" />
                </div>
                <div className="ml-2 hidden sm:flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bets-primary)] text-white text-xs font-bold">
                    {initial}
                  </div>
                  <span className="text-sm font-medium text-[var(--bets-text-dark)] max-w-[100px] truncate">{user.name}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-2 gap-1.5 rounded-full border-[var(--color-border-strong)]"
                  onClick={async () => {
                    await logout();
                    nav("/");
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <NavItem to="/" label="Login" />
                <NavItem to="/" label="Register" />
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
