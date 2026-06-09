import { describe, expect, it } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import { processNpcDay } from "./npc";

describe("NPC daily decisions", () => {
  it("keeps NPC changes inside declared bounds and deterministic for a date", () => {
    const state = playableStateFixture();
    const first = processNpcDay(state.npcAirlines, state.currentDate);
    const second = processNpcDay(state.npcAirlines, state.currentDate);

    expect(first).toEqual(second);
    for (const npc of first) {
      expect(npc.priceBias).toBeGreaterThanOrEqual(0.75);
      expect(npc.priceBias).toBeLessThanOrEqual(1.25);
      expect(npc.frequencyBias).toBeGreaterThanOrEqual(0.75);
      expect(npc.frequencyBias).toBeLessThanOrEqual(1.25);
    }
  });

  it("does not mutate NPC state and can produce different decisions on another date", () => {
    const state = playableStateFixture();
    const original = structuredClone(state.npcAirlines);
    const first = processNpcDay(state.npcAirlines, state.currentDate);
    const next = processNpcDay(state.npcAirlines, "2027-03-19");

    expect(state.npcAirlines).toEqual(original);
    expect(first).not.toBe(state.npcAirlines);
    expect(next).not.toEqual(first);
  });

  it("normalizes invalid current biases into safe finite bounds", () => {
    const state = playableStateFixture();
    const result = processNpcDay(
      state.npcAirlines.map((npc, index) => ({
        ...npc,
        priceBias: index === 0 ? Number.NaN : 99,
        frequencyBias: index === 0 ? Number.POSITIVE_INFINITY : -99,
      })),
      state.currentDate,
    );

    for (const npc of result) {
      expect(Number.isFinite(npc.priceBias)).toBe(true);
      expect(Number.isFinite(npc.frequencyBias)).toBe(true);
      expect(npc.priceBias).toBeGreaterThanOrEqual(0.75);
      expect(npc.priceBias).toBeLessThanOrEqual(1.25);
      expect(npc.frequencyBias).toBeGreaterThanOrEqual(0.75);
      expect(npc.frequencyBias).toBeLessThanOrEqual(1.25);
    }
  });
});
