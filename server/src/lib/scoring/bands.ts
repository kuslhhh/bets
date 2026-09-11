export type Band = { id: 1 | 2 | 3 | 4; label: string };

export const BANDS: Record<Band["id"], Band> = {
  1: { id: 1, label: "Strong" },
  2: { id: 2, label: "Developing" },
  3: { id: 3, label: "Needs attention" },
  4: { id: 4, label: "Critical" },
};

export function getBand(score: number): Band {
  if (score >= 75.01) return BANDS[1];
  if (score >= 50.01) return BANDS[2];
  if (score >= 25.01) return BANDS[3];
  return BANDS[4];
}
