import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message;
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#fdfcff] relative overflow-hidden">
          {/* soft decorative blobs */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-[#f5eefb] blur-3xl opacity-60" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full bg-[#faf5ff] blur-3xl opacity-70" />

          <div className="relative w-full max-w-[480px]">
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
              <div className="h-1.5 w-full bg-gradient-to-r from-[var(--bets-primary)] via-[#9B6EC1] to-[#C4A7E0]" />
              <div className="px-7 py-8 md:px-9 md:py-9 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5eefb] border border-[#e9d5ff]">
                  <AlertTriangle className="h-7 w-7 text-[var(--bets-primary)]" />
                </div>

                <h1 className="mt-5 text-[20px] font-bold tracking-tight text-[var(--bets-text-dark)]">
                  Something went wrong
                </h1>
                <p className="mt-2 text-[13.5px] leading-6 text-[var(--bets-text-muted)]">
                  An unexpected error broke this page. Don&apos;t worry — your data is safe.
                  <br />
                  Try again or reload to continue.
                </p>

                {msg && (
                  <details className="mt-5 text-left group">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--bets-text-muted)] hover:text-[var(--bets-text)] list-none flex items-center justify-center gap-1">
                      <span className="underline decoration-dotted underline-offset-4">Show error details</span>
                      <span className="text-[11px] group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-red-100 bg-red-50/70 p-3 text-xs leading-5 text-red-700 whitespace-pre-wrap break-words">
                      {msg}
                    </pre>
                  </details>
                )}

                <div className="mt-7 flex gap-3 justify-center">
                  <button
                    onClick={this.handleReset}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--bets-primary)] px-5 text-[13.5px] font-semibold text-white hover:bg-[var(--bets-primary-dark)] transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border-strong)] bg-white px-5 text-[13.5px] font-semibold text-[var(--bets-text-dark)] hover:bg-[#f8f8f9] transition-colors"
                  >
                    Reload page
                  </button>
                </div>

                <p className="mt-6 text-xs text-[var(--bets-text-muted)]">
                  If this keeps happening, please contact support.
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-[var(--bets-text-muted)]">
              Finance Assessment • BEtS Consulting
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
