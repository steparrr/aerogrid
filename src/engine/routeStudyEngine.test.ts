import { describe, expect, it } from "vitest";

import type { CompetitorAirline, GameState } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { buildRouteStudy } from "./routeStudyEngine";

function studyState(): GameState {
  const base = playableStateFixture();
  const routeKey = "FCO-LHR";
  const competitors: CompetitorAirline[] = [
    {
      ...base.competitors[0]!,
      id: "active-dominant",
      name: "Britannia Test",
      archetype: "LEGACY_DOMINANT",
      activeRoutes: [routeKey],
      memory: {
        aggressionLevel: 80,
        lastPlayerActions: [],
        price_response_history: [
          { date: "2027-01-01", pct: 0.08, trigger: "PLAYER_OPENS_ROUTE" },
        ],
        route_entry_history: [
          { date: "2026-12-01", routeKey, eventType: "ENTER" },
        ],
      },
    },
    {
      ...base.competitors[1]!,
      id: "inactive",
      name: "Unrelated Air",
      activeRoutes: ["DXB-SIN"],
    },
  ];

  return {
    ...base,
    competitors,
    airports: {
      ...base.airports,
      LHR: {
        ...base.airports.LHR!,
        slot_pool_available: 0,
        slot_market_price: 25_000_000,
      },
    },
  };
}

describe("route study engine", () => {
  it("derives six segments, twelve seasonal points and real route finance data", () => {
    const study = buildRouteStudy(studyState(), "FCO", "LHR");

    expect(study.market.segments).toHaveLength(6);
    expect(study.market.seasonality).toHaveLength(12);
    expect(Object.keys(study.market.seasonality[0]?.segmentFactors ?? {})).toHaveLength(
      6,
    );
    expect(study.distanceKm).toBeGreaterThan(0);
    expect(study.market.totalPassengers).toBeGreaterThan(0);
    expect(study.market.drivers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Turismo destinazione" }),
        expect.objectContaining({ label: "Business gateway" }),
      ]),
    );
    expect(study.proposal?.forecast.costs.fuel).toBeGreaterThan(0);
    expect(study.finance?.breakEvenLoadFactor).toBeGreaterThan(0);
    expect(study.finance?.ramp).toHaveLength(4);
  });

  it("uses only active O/D competitors and exposes their deterministic response and history", () => {
    const study = buildRouteStudy(studyState(), "FCO", "LHR");

    expect(study.competitors).toHaveLength(1);
    expect(study.competitors[0]?.name).toBe("Britannia Test");
    expect(study.competitors[0]?.economyPrice).toBeGreaterThan(0);
    expect(study.competitors[0]?.history).toHaveLength(2);
    expect(study.competitors[0]?.response.type).not.toBe("");
    expect(study.competitors[0]?.marketShareWithoutPlayer).toBeGreaterThan(
      study.competitors[0]?.marketShare ?? 0,
    );
    expect(study.marketShare.withPlayer).toBeGreaterThan(0);
    expect(study.marketShare.withoutPlayer).toBe(0);
  });

  it("reports missing slot and aircraft prerequisites inline without inventing unavailable ETS cost", () => {
    const state = studyState();
    const noCompatibleAircraft = {
      ...state,
      fleet: state.fleet.map((aircraft) => ({
        ...aircraft,
        modelId: "atr-72-600",
      })),
    };

    const study = buildRouteStudy(noCompatibleAircraft, "FCO", "JFK");

    expect(study.proposal).toBeNull();
    expect(study.distanceKm).toBeGreaterThan(0);
    expect(study.prerequisites.join(" ")).toMatch(/aereo compatibile/i);
    expect(study.risks.etsCost).toBeNull();
  });
});
