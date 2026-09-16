// Helper for integration tests — enforces isolated DB contract.
// Local dev: skip gracefully when TEST_DATABASE_URL is missing.
// CI (CI=true or GITHUB_ACTIONS): MUST fail if TEST_DATABASE_URL is missing.
export function getTestDbStatus(): { hasDb: boolean; ci: boolean } {
  const hasDb = Boolean(process.env.TEST_DATABASE_URL);
  const ci = Boolean(process.env.CI ?? process.env.GITHUB_ACTIONS);
  return { hasDb, ci };
}

export function assertTestDbForIntegration(): boolean {
  const { hasDb, ci } = getTestDbStatus();
  if (!hasDb && ci) {
    throw new Error("TEST_DATABASE_URL is required in CI — integration tests must run against the isolated finance_test database");
  }
  return hasDb;
}
