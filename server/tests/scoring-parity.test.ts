// Scoring parity: the client mirror (client/src/lib/bands.ts, display-only)
// must stay identical to the server authority (server/src/lib/scoring/*).
// No shared package by design (see docs/TARGET_ARCHITECTURE.md) — this test
// is the drift guard.
import { describe, it, expect } from "vitest";
import { getBand as serverBand } from "../src/lib/scoring/bands.js";
import { EXPECTED as SERVER_EXPECTED } from "../src/lib/scoring/constants.js";
import { getBand as clientBand, EXPECTED as CLIENT_EXPECTED } from "../../client/src/lib/bands.js";

describe("scoring parity (server authoritative, client mirror)", () => {
  it("band thresholds + labels match", () => {
    for (const score of [100, 75.01, 75, 50.01, 50, 25.01, 25, 0]) {
      const s = serverBand(score);
      const c = clientBand(score);
      expect(c.id, `band id @${score}`).toBe(s.id);
      expect(c.label, `band label @${score}`).toBe(s.label);
    }
  });
  it("EXPECTED benchmark matches", () => {
    expect(CLIENT_EXPECTED).toBe(SERVER_EXPECTED);
    expect(SERVER_EXPECTED).toBe(75);
  });
});
