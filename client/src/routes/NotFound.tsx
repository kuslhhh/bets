import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export function NotFoundPage() {
  const nav = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-14 md:py-20 px-4 text-center">
      <p className="select-none text-[84px] md:text-[104px] font-black leading-none tracking-tighter text-[#f3e8ff]">404</p>

      <h1 className="mt-6 text-xl md:text-2xl font-bold tracking-tight text-[var(--bets-text-dark)]">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-[13.5px] leading-6 text-[var(--bets-text-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or was moved. Check the URL or head back to your assessment.
      </p>

      <div className="mt-7 flex flex-wrap gap-3 justify-center">
        <Link
          to="/available"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--bets-primary)] px-5 text-[13.5px] font-semibold text-white hover:bg-[var(--bets-primary-dark)] transition-colors"
        >
          <Compass className="h-4 w-4" />
          Go to Assessment
        </Link>
        <button
          onClick={() => nav(-1)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-white px-5 text-[13.5px] font-semibold text-[var(--bets-text-dark)] hover:bg-[#f8f8f9] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    </div>
  );
}
