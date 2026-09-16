import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-[var(--bets-primary)] !text-white hover:!text-white" : "text-[var(--bets-text)] hover:bg-[#f5eefb] hover:text-[var(--bets-primary)]"}`
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

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b bg-white border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-bold text-[var(--bets-primary)] text-lg tracking-tight">
            Finance Assessment
          </Link>
          <nav className="flex items-center gap-1">
            {user ? (
              <>
                <NavItem to="/available" label="Available" />
                <NavItem to="/my-assessments" label="My Assessments" />
                {isAdmin && (
                  <>
                    <NavItem to="/admin/dashboard" label="Dashboard" />
                    <NavItem to="/admin/users" label="Users" />
                    <NavItem to="/admin/assessments" label="Assessments" />
                    <NavItem to="/admin/reports" label="Reports" />
                  </>
                )}
                <span className="ml-2 text-sm text-[var(--bets-text-muted)] hidden sm:inline">
                  {user.name} · {role}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={async () => {
                    await logout();
                    nav("/login");
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <NavItem to="/login" label="Login" />
                <NavItem to="/register" label="Register" />
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
