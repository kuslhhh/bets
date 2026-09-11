// BEtS palette — JS mirror of CSS vars in src/index.css (single source of hex)
// Use this for Recharts, inline styles, or any JS-driven color — never hardcode hex in components.
export const betsColors = {
  primary: "#743E95",
  primaryDark: "#5F307D",
  text: "#333333",
  textMuted: "#646979",
  textDark: "#33373D",
  black: "#000000",
  white: "#FFFFFF",
  border: "#E9E2F0",
  borderStrong: "#DDD3E8",
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
