import { describe, expect, it } from "vitest";

import type { GameState } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import {
  applyMissionTurnEffects,
  evaluateMission,
  getMissionStatus,
  MISSIONS,
  type MissionProgress,
} from "./missionEngine";

describe("missionEngine", () => {
  it("defines the five playable missions and their required scenarios", () => {
    expect(MISSIONS.map((mission) => mission.code)).toEqual([
      "T1",
      "T2",
      "C1",
      "R1",
      "E1",
    ]);
    expect(MISSIONS.map((mission) => mission.turns_limit)).toEqual([
      15, 20, 25, 35, 40,
    ]);

    const firstFlight = MISSIONS[0];
    expect(firstFlight.starting_state.cash).toBe(100_000_000);
    expect(firstFlight.starting_state.fleet).toHaveLength(1);
    expect(firstFlight.starting_state.fleet?.[0]?.modelId).toBe("airbus-a220-300");
    expect(firstFlight.starting_state.routes).toEqual([]);
    expect(firstFlight.tutorial_steps).toHaveLength(4);
  });

  it("unlocks missions in sequence and preserves the best medal", () => {
    const progress: MissionProgress = {
      T1: { completed: true, best_medal: "SILVER" },
    };

    expect(getMissionStatus("T1", progress)).toEqual({
      state: "COMPLETED",
      best_medal: "SILVER",
      prerequisite: null,
    });
    expect(getMissionStatus("T2", progress).state).toBe("AVAILABLE");
    expect(getMissionStatus("C1", progress)).toEqual({
      state: "LOCKED",
      best_medal: null,
      prerequisite: "T2",
    });
  });

  it("evaluates objective progress and awards the highest earned medal", () => {
    const base = playableStateFixture();
    const secondRoute = {
      ...base.routes[0],
      id: "route-fco-lhr",
      destinationIata: "LHR",
    };
    const game: GameState = {
      ...base,
      turn: 12,
      cash: 120_000_000,
      routes: [base.routes[0], secondRoute],
      player: {
        ...base.player,
        cash: 120_000_000,
        routes: [base.routes[0], secondRoute],
        core_kpis: {
          ...base.player.core_kpis,
          load_factor_avg: 0.82,
          ebitda_margin: 0.12,
        },
      },
    };

    const result = evaluateMission("T1", game);

    expect(result.status).toBe("COMPLETED");
    expect(result.medal).toBe("GOLD");
    expect(result.objectives.every((objective) => objective.completed)).toBe(
      true,
    );
  });

  it("fails an unfinished mission after its turn limit", () => {
    const game = {
      ...playableStateFixture(),
      turn: 21,
      routes: [],
    };

    const result = evaluateMission("T2", game);

    expect(result.status).toBe("FAILED");
    expect(result.medal).toBeNull();
  });

  it("applies C1 fuel shock exactly on turn three without mutating state", () => {
    const game = {
      ...playableStateFixture(),
      market_fuel_price: 1,
    };

    const beforeShock = applyMissionTurnEffects("C1", game, 2);
    const shock = applyMissionTurnEffects("C1", game, 3);

    expect(beforeShock).toBe(game);
    expect(shock).not.toBe(game);
    expect(shock.market_fuel_price).toBe(1.6);
    expect(game.market_fuel_price).toBe(1);
  });
});
