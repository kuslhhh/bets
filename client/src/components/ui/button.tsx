import * as React from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary:
    "bg-[var(--bets-primary)] text-white hover:bg-[var(--bets-primary-dark)] focus-visible:ring-[var(--bets-primary)] border-transparent",
  secondary:
    "bg-white text-[var(--bets-text)] border-[var(--color-border-strong)] hover:bg-[#f8f5fc] hover:border-[var(--bets-primary)]",
  outline:
    "bg-white text-[var(--bets-primary)] border-[var(--bets-primary)] hover:bg-[#f5eefb]",
  ghost: "bg-transparent text-[var(--bets-text)] hover:bg-[#f5eefb] hover:text-[var(--bets-primary)] border-transparent",
};

const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...props}
    />
  );
}
