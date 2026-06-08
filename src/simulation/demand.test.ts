import { describe, expect, it } from "vitest";

import { airportByIata } from "../data/indexes";
import type { DemandEstimate } from "../domain/types";
import { generateDailyODDemand } from "./demand";

const fco = airportByIata.get("FCO")!;
const jfk = airportByIata.get("JFK")!;

function expectFiniteNonNegativeDemand(demand: DemandEstimate) {
  for (const value of Object.values(demand)) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }

  expect(demand.total).toBe(demand.business + demand.leisure + demand.vfr);
}

describe("generateDailyODDemand", () => {
  it("returns finite non-negative demand for a real airport pair", () => {
    const demand = generateDailyODDemand("2026-06-08", fco, jfk);

    expectFiniteNonNegativeDemand(demand);
    expect(demand.total).toBeGreaterThan(0);
    expect(demand.expectedBusinessYield).toBeGreaterThan(
      demand.expectedEconomyYield,
    );
  });

  it("is deterministic for the same inputs", () => {
    const first = generateDailyODDemand("2026-06-08", fco, jfk);
    const second = generateDailyODDemand("2026-06-08", fco, jfk);

    expect(second).toEqual(first);
  });

  it("varies demand by seasonal month", () => {
    const winter = generateDailyODDemand("2026-01-08", fco, jfk);
    const summer = generateDailyODDemand("2026-07-08", fco, jfk);

    expect(summer.seasonality).not.toBe(winter.seasonality);
    expect(summer.total).not.toBe(winter.total);
  });

  it("returns zero demand for identical endpoints", () => {
    const demand = generateDailyODDemand("2026-06-08", fco, fco);

    expectFiniteNonNegativeDemand(demand);
    expect(demand).toEqual({
      business: 0,
      leisure: 0,
      vfr: 0,
      total: 0,
      expectedEconomyYield: 0,
      expectedBusinessYield: 0,
      seasonality: 1,
    });
  });

  it("rejects an invalid date instead of producing invalid output", () => {
    expect(() => generateDailyODDemand("not-a-date", fco, jfk)).toThrow(
      RangeError,
    );
  });
});
