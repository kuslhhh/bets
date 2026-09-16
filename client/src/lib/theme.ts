// BEtS palette — JS mirror of CSS vars in src/index.css (single source of hex)
// Use this for Recharts, inline styles, or any JS-driven color — never hardcode hex in components.
export const betsColors = {
  primary: "#743E95",
  primaryDark: "#5F307D",
  text: "#222222",
  textMuted: "#5A5E6B",
  textDark: "#1A1D23",
  black: "#000000",
  white: "#FFFFFF",
  canvas: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  borderSoft: "#EEF0F3",
} as const;

// For CSS var usage in inline styles: `var(--bets-primary)` etc.
export const betsVars = {
  primary: "var(--bets-primary)",
  primaryDark: "var(--bets-primary-dark)",
  text: "var(--bets-text)",
  textMuted: "var(--bets-text-muted)",
  textDark: "var(--bets-text-dark)",
  border: "var(--color-border)",
  ring: "var(--ring)",
} as const;
