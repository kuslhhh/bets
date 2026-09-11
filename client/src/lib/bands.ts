// Mirrors server/src/lib/scoring/bands.ts — display only, never compute scores client-side.
import { betsColors } from "./theme";

export type Band = { id: 1 | 2 | 3 | 4; label: string; color: string };

export const BANDS: Record<Band["id"], Band> = {
  1: { id: 1, label: "Strong", color: "#1a7f37" },
  2: { id: 2, label: "Developing", color: betsColors.primary },
  3: { id: 3, label: "Needs attention", color: "#bf6900" },
  4: { id: 4, label: "Critical", color: "#cf222e" },
};

export function getBand(score: number): Band {
  if (score >= 75.01) return BANDS[1];
  if (score >= 50.01) return BANDS[2];
  if (score >= 25.01) return BANDS[3];
  return BANDS[4];
}

export const EXPECTED = 75;
