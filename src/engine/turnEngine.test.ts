import { describe, expect, it } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import {
  advanceGameDate,
  processTurn,
  updateFuelBenchmark,
  updateSlotStatuses,
} from "./turnEngine";

describe("turn engine", () => {
  it("advances a December game date into January", () => {
    expect(advanceGameDate({ year: 2027, month: 12 })).toEqual({
      year: 2028,
      month: 1,
    });
  });

  it("updates fuel deterministically inside the documented benchmark range", () => {
    const first = updateFuelBenchmark(0.8, 3);
    const second = updateFuelBenchmark(0.8, 3);

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0.65);
    expect(first).toBeLessThanOrEqual(0.95);
  });

  it("marks slots below 80 percent utilization at risk", () => {
    const slots = updateSlotStatuses([
      {
        airport_id: "FCO",
        owner_id: "player",
        purchase_price: 0,
        market_value: 0,
        utilization_this_season: 0.79,
        status: "ACTIVE",
      },
    ]);

    expect(slots[0]?.status).toBe("AT_RISK");
  });

  it("processes a monthly turn without mutating the input", () => {
    const state = playableStateFixture();
    const snapshot = structuredClone(state);

    const first = processTurn(state);
    const second = processTurn(state);

    expect(state).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first.turn).toBe(state.turn + 1);
    expect(first.game_date).toEqual({ year: 2027, month: 4 });
    expect(first.currentDate).toBe("2027-04-18");
    expect(first.player.cash).toBe(first.cash);
    expect(first.player.routes).toEqual(first.routes);
  });

  it("records bankruptcy after two consecutive negative-cash turns", () => {
    const state = {
      ...playableStateFixture(),
      cash: -1,
      consecutive_negative_cash_turns: 1,
    };
    state.player = { ...state.player, cash: -1 };

    const next = processTurn(state);

    expect(next.consecutive_negative_cash_turns).toBe(2);
    expect(next.game_status).toBe("BANKRUPT");
    expect(next.events_log.some((event) => event.type === "BANKRUPTCY")).toBe(
      true,
    );
  });
});
