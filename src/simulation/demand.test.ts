import { describe, expect, it } from "vitest";

import { airportByIata, cityById } from "../data/indexes";
import type { DemandEstimate } from "../domain/types";
import { generateDailyODDemand } from "./demand";

const fco = airportByIata.get("FCO")!;
const jfk = airportByIata.get("JFK")!;
const sin = airportByIata.get("SIN")!;
const syd = airportByIata.get("SYD")!;

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

  it("shifts destination seasonality by hemisphere", () => {
    const northernJanuary = generateDailyODDemand("2026-01-08", fco, jfk);
    const northernJuly = generateDailyODDemand("2026-07-08", fco, jfk);
    const southernJanuary = generateDailyODDemand("2026-01-08", fco, syd);
    const southernJuly = generateDailyODDemand("2026-07-08", fco, syd);

    expect(northernJuly.leisure).toBeGreaterThan(northernJanuary.leisure);
    expect(southernJanuary.leisure).toBeGreaterThan(southernJuly.leisure);
  });

  it("reduces seasonal amplitude for equatorial destinations", () => {
    const northernJanuary = generateDailyODDemand("2026-01-08", fco, jfk);
    const northernJuly = generateDailyODDemand("2026-07-08", fco, jfk);
    const equatorialJanuary = generateDailyODDemand("2026-01-08", fco, sin);
    const equatorialJuly = generateDailyODDemand("2026-07-08", fco, sin);

    const northernAmplitude =
      northernJuly.seasonality - northernJanuary.seasonality;
    const equatorialAmplitude =
      equatorialJuly.seasonality - equatorialJanuary.seasonality;

    expect(equatorialAmplitude).toBeGreaterThan(0);
    expect(equatorialAmplitude).toBeLessThan(northernAmplitude);
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

  it("keeps demand finite for large finite city inputs", () => {
    const originCityId = "test-large-origin";
    const destinationCityId = "test-large-destination";
    const originCity = {
      ...cityById.get(fco.cityId)!,
      id: originCityId,
      population: Number.MAX_VALUE,
    };
    const destinationCity = {
      ...cityById.get(jfk.cityId)!,
      id: destinationCityId,
      population: Number.MAX_VALUE,
    };
    const originAirport = {
      ...fco,
      id: "airport-test-large-origin",
      cityId: originCityId,
    };
    const destinationAirport = {
      ...jfk,
      id: "airport-test-large-destination",
      cityId: destinationCityId,
    };

    cityById.set(originCityId, originCity);
    cityById.set(destinationCityId, destinationCity);

    try {
      const demand = generateDailyODDemand(
        "2026-06-08",
        originAirport,
        destinationAirport,
      );

      expectFiniteNonNegativeDemand(demand);
      expect(demand.total).toBeGreaterThan(0);
    } finally {
      cityById.delete(originCityId);
      cityById.delete(destinationCityId);
    }
  });

  it("saturates demand when multiple finite metrics would overflow", () => {
    const originCityId = "test-extreme-origin";
    const destinationCityId = "test-extreme-destination";
    const originCity = {
      ...cityById.get(fco.cityId)!,
      id: originCityId,
      population: Number.MAX_VALUE,
      gdpPerCapita: Number.MAX_VALUE,
      tourismScore: Number.MAX_VALUE,
      businessScore: Number.MAX_VALUE,
      diasporaScore: Number.MAX_VALUE,
    };
    const destinationCity = {
      ...cityById.get(jfk.cityId)!,
      id: destinationCityId,
      population: Number.MAX_VALUE,
      gdpPerCapita: Number.MAX_VALUE,
      tourismScore: Number.MAX_VALUE,
      businessScore: Number.MAX_VALUE,
      diasporaScore: Number.MAX_VALUE,
    };
    const originAirport = {
      ...fco,
      id: "airport-test-extreme-origin",
      cityId: originCityId,
      businessGatewayScore: Number.MAX_VALUE,
      touristGatewayScore: Number.MAX_VALUE,
      hubPotentialScore: Number.MAX_VALUE,
    };
    const destinationAirport = {
      ...jfk,
      id: "airport-test-extreme-destination",
      cityId: destinationCityId,
      businessGatewayScore: Number.MAX_VALUE,
      touristGatewayScore: Number.MAX_VALUE,
      hubPotentialScore: Number.MAX_VALUE,
    };

    cityById.set(originCityId, originCity);
    cityById.set(destinationCityId, destinationCity);

    try {
      const demand = generateDailyODDemand(
        "2026-06-08",
        originAirport,
        destinationAirport,
      );

      expectFiniteNonNegativeDemand(demand);
      expect(demand.business).toBeGreaterThan(0);
      expect(demand.leisure).toBeGreaterThan(0);
      expect(demand.vfr).toBeGreaterThan(0);
      expect(demand.total).toBeGreaterThan(0);
    } finally {
      cityById.delete(originCityId);
      cityById.delete(destinationCityId);
    }
  });
});
