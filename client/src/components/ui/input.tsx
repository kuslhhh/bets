import * as React from "react";
import { cn } from "../../lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-[36px] w-full rounded-[var(--radius-input)] border bg-[#fcfcfd] px-3 py-2 text-[13px] text-[var(--bets-text-dark)] placeholder:text-[#8a8f9e] border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--bets-primary)] focus-visible:border-[var(--bets-primary)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
