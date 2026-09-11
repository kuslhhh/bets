import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/layout";
import { useAuth } from "../lib/auth";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { role, hasPermission, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (role !== "ADMIN" && !hasPermission("users.view")) return <div className="p-8 text-[var(--bets-text)]">403 — unauthorised</div>;
  return <>{children}</>;
}

import { LoginPage } from "./Login";
import { RegisterPage } from "./Register";
import { AvailablePage } from "./Available";
import { MyAssessmentsPage } from "./MyAssessments";
import { DashboardPage } from "./Dashboard";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/available" replace /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        path: "/available",
        element: (
          <Protected>
            <AvailablePage />
          </Protected>
        ),
      },
      {
        path: "/my-assessments",
        element: (
          <Protected>
            <MyAssessmentsPage />
          </Protected>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <Protected>
            <AdminOnly>
              <DashboardPage />
            </AdminOnly>
          </Protected>
        ),
      },
      { path: "*", element: <div className="p-8 text-[var(--bets-text-muted)]">404 — not found</div> },
    ],
  },
]);
