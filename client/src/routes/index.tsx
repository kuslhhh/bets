import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/layout";
import { useAuth } from "../lib/auth";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { role, hasPermission, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (role !== "ADMIN" && !hasPermission("users.view")) return <div className="p-8 text-[var(--bets-text)]">403 — unauthorised</div>;
  return <>{children}</>;
}
function UserOnly({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-[var(--bets-text-muted)]">Loading…</div>;
  if (role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}

import { RegisterLandingPage } from "./RegisterLanding";
import { AvailablePage } from "./Available";
import { DashboardPage } from "./Dashboard";
import { TakingPage } from "./Taking";
import { ResultsPage } from "./Results";
import { ReportsPage } from "./Reports";
import { UsersPage } from "./Users";
import { AssessmentsPage, AssessmentDetailPage } from "./Assessments";
import { ResetPasswordPage } from "./ResetPassword";
import { ProfilePage } from "./Profile";
import { NotFoundPage } from "./NotFound";

export const router = createBrowserRouter([
  { path: "/", element: <RegisterLandingPage /> },
  { path: "/register", element: <Navigate to="/" replace /> },
  {
    element: <Layout />,
    children: [
      { path: "/login", element: <Navigate to="/" replace /> },
      { path: "/forgot-password", element: <Navigate to="/" replace /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      {
        path: "/available",
        element: (
          <Protected>
            <UserOnly>
              <AvailablePage />
            </UserOnly>
          </Protected>
        ),
      },
      { path: "/my-assessments", element: <Navigate to="/available" replace /> },
      // Admin prefixed routes + legacy /dashboard /users aliases
      { path: "/dashboard", element: <Navigate to="/admin/dashboard" replace /> },
      { path: "/users", element: <Navigate to="/admin/users" replace /> },
      { path: "/reports", element: <Navigate to="/admin/reports" replace /> },
      { path: "/assessments", element: <Navigate to="/admin/assessments" replace /> },
      {
        path: "/admin/dashboard",
        element: (
          <Protected>
            <AdminOnly>
              <DashboardPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/dashboard/:userId",
        element: (
          <Protected>
            <AdminOnly>
              <DashboardPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/users",
        element: (
          <Protected>
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/users/:userId",
        element: (
          <Protected>
            <AdminOnly>
              <DashboardPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/reports",
        element: (
          <Protected>
            <AdminOnly>
              <ReportsPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/assessments",
        element: (
          <Protected>
            <AdminOnly>
              <AssessmentsPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/admin/assessments/:id",
        element: (
          <Protected>
            <AdminOnly>
              <AssessmentDetailPage />
            </AdminOnly>
          </Protected>
        ),
      },
      {
        path: "/assignments/:id",
        element: (
          <Protected>
            <UserOnly>
              <TakingPage />
            </UserOnly>
          </Protected>
        ),
      },
      {
        path: "/assessments/:id/take",
        element: (
          <Protected>
            <UserOnly>
              <TakingPage />
            </UserOnly>
          </Protected>
        ),
      },
      {
        path: "/results/:id",
        element: (
          <Protected>
            <ResultsPage />
          </Protected>
        ),
      },
      {
        path: "/profile",
        element: (
          <Protected>
            <ProfilePage />
          </Protected>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
