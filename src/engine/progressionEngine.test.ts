import { describe, expect, it } from "vitest";

import type { GameState, Route } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import {
  checkLevelUp,
  getMilestoneProgress,
  getNextLevelProgress,
  getUnlockedFeatures,
  isFeatureUnlocked,
} from "./progressionEngine";

function activeRoutes(state: GameState, count: number, destinations = ["JFK"]) {
  const seed = state.routes[0];

  return Array.from({ length: count }, (_, index): Route => ({
    ...seed,
    id: `route-${index}`,
    destinationIata: destinations[index % destinations.length],
    status: "active",
  }));
}

function withPlayer(state: GameState, patch: Partial<GameState["player"]>) {
  return {
    ...state,
    player: {
      ...state.player,
      ...patch,
    },
  };
}

describe("progressionEngine", () => {
  it("levels up from startup with 8 active routes and returns the narrative unlocks", () => {
    const state = playableStateFixture();
    const routes = activeRoutes(state, 8);
    const eligible = withPlayer(
      { ...state, routes },
      { level: 1, routes },
    );

    const result = checkLevelUp(eligible);

    expect(result?.newLevel).toBe(2);
    expect(result?.title).toBe("REGIONAL");
    expect(result?.unlockedFeatures.map((feature) => feature.id)).toContain(
      "GDS_SUBSCRIPTION",
    );
    expect(result?.nextObjective).toMatch(/hub.*30%/i);
  });

  it("uses the exact alternative conditions for levels 2, 3 and 4", () => {
    const base = playableStateFixture();
    const narrowFleet = base.fleet.map((aircraft) => ({
      ...aircraft,
      modelId: "airbus-a220-300",
    }));

    const networkState = withPlayer(
      { ...base, fleet: narrowFleet },
      {
        level: 2,
        fleet: narrowFleet,
        core_kpis: {
          ...base.player.core_kpis,
          hub_dominance_pct: 0.31,
        },
      },
    );
    expect(checkLevelUp(networkState)?.newLevel).toBe(3);

    const majorRoutes = activeRoutes(base, 20).map((route) => ({
      ...route,
      margin_monthly: 42_000_000,
    }));
    const majorState = withPlayer(
      { ...base, routes: majorRoutes },
      { level: 3, routes: majorRoutes },
    );
    expect(checkLevelUp(majorState)?.newLevel).toBe(4);

    const globalRoutes = activeRoutes(base, 60, ["JFK", "GRU", "FCO"]);
    const globalState = withPlayer(
      { ...base, routes: globalRoutes },
      { level: 4, routes: globalRoutes },
    );
    expect(checkLevelUp(globalState)?.newLevel).toBe(5);
  });

  it("does not level up when only part of the level 5 condition is met", () => {
    const base = playableStateFixture();
    const routes = activeRoutes(base, 60, ["JFK"]);
    const state = withPlayer({ ...base, routes }, { level: 4, routes });

    expect(checkLevelUp(state)).toBeNull();
  });

  it("returns level-specific unlocks and checks features sequentially", () => {
    const state = withPlayer(playableStateFixture(), { level: 2 });

    expect(getUnlockedFeatures(3).map((feature) => feature.id)).toContain(
      "FUEL_HEDGING",
    );
    expect(isFeatureUnlocked("GDS_SUBSCRIPTION", state)).toBe(true);
    expect(isFeatureUnlocked("FUEL_HEDGING", state)).toBe(false);
    expect(isFeatureUnlocked("UNKNOWN_FEATURE", state)).toBe(false);
  });

  it("derives next-level KPI progress and milestone status from GameState", () => {
    const base = playableStateFixture();
    const profitableRoute = {
      ...base.routes[0],
      performanceHistory: [1, 2, 3].map((index) => ({
        date: `2027-0${index}-01`,
        passengers: 100,
        loadFactor: 0.8,
        revenue: 200_000,
        costs: 150_000,
        profit: 50_000,
        availableSeatKm: 1_000_000,
      })),
    };
    const state = withPlayer(
      {
        ...base,
        routes: [profitableRoute],
        events_log: [
          {
            id: "ma-1",
            turn: 4,
            type: "MA_COMPLETED",
            message: "Acquisizione completata",
          },
        ],
      },
      {
        level: 2,
        routes: [profitableRoute],
        core_kpis: {
          ...base.player.core_kpis,
          hub_dominance_pct: 0.2,
        },
      },
    );

    const progress = getNextLevelProgress(state);
    const milestones = getMilestoneProgress(state);

    expect(progress?.targetLevel).toBe(3);
    expect(progress?.metrics.find((metric) => metric.id === "HUB_SHARE")).toMatchObject({
      current: 20,
      target: 30,
    });
    expect(milestones.find((milestone) => milestone.id === "FIRST_PROFITABLE_ROUTE")?.status).toBe(
      "ACHIEVED",
    );
    expect(milestones.find((milestone) => milestone.id === "FIRST_ACQUISITION")?.status).toBe(
      "LOCKED",
    );
  });
});
