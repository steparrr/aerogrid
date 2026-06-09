import { describe, expect, it } from "vitest";

import { aircraftModelById, airportByIata } from "../data/indexes";
import { checkRouteCompatibility } from "./compatibility";

const atr72 = aircraftModelById.get("atr-72-600")!;
const boeing787 = aircraftModelById.get("boeing-787-9")!;
const boeing767f = aircraftModelById.get("boeing-767f")!;
const fco = airportByIata.get("FCO")!;
const jfk = airportByIata.get("JFK")!;

describe("checkRouteCompatibility", () => {
  it("rejects an aircraft without enough operational range", () => {
    const result = checkRouteCompatibility({
      model: atr72,
      origin: fco,
      destination: jfk,
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain("range");
  });

  it("accepts a suitable long-haul passenger aircraft", () => {
    const result = checkRouteCompatibility({
      model: boeing787,
      origin: fco,
      destination: jfk,
    });

    expect(result).toEqual({ compatible: true, reasons: [] });
  });

  it("reports the airport whose runway is too short", () => {
    const shortOrigin = { ...fco, runwayLengthM: 2_000 };
    const shortDestination = { ...jfk, runwayLengthM: 2_000 };

    expect(
      checkRouteCompatibility({
        model: boeing787,
        origin: shortOrigin,
        destination: jfk,
      }).reasons,
    ).toContain("origin-runway");
    expect(
      checkRouteCompatibility({
        model: boeing787,
        origin: fco,
        destination: shortDestination,
      }).reasons,
    ).toContain("destination-runway");
  });

  it("rejects freighters for passenger routes", () => {
    const result = checkRouteCompatibility({
      model: boeing767f,
      origin: fco,
      destination: jfk,
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons).toContain("freighter");
  });

  it("reports unavailable aircraft and excessive weekly utilization", () => {
    const result = checkRouteCompatibility({
      model: boeing787,
      origin: fco,
      destination: jfk,
      aircraft: {
        available: false,
        currentWeeklyUtilizationHours: 100,
        proposedWeeklyUtilizationHours: 20,
        maxWeeklyUtilizationHours: 112,
      },
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["unavailable", "utilization"]),
    );
  });

  it("rejects invalid coordinates without throwing", () => {
    const invalidOrigin = {
      ...fco,
      coordinates: { lat: Number.NaN, lon: 12.24 },
    };

    expect(() =>
      checkRouteCompatibility({
        model: boeing787,
        origin: invalidOrigin,
        destination: jfk,
      }),
    ).not.toThrow();
    expect(
      checkRouteCompatibility({
        model: boeing787,
        origin: invalidOrigin,
        destination: jfk,
      }).reasons,
    ).toContain("invalid-coordinates");
  });

  it("reports invalid model and airport runway data explicitly", () => {
    const invalidModel = {
      ...boeing787,
      rangeKm: Number.NaN,
      runwayRequirementM: Number.POSITIVE_INFINITY,
    };
    const invalidOrigin = { ...fco, runwayLengthM: Number.NaN };
    const invalidDestination = {
      ...jfk,
      runwayLengthM: Number.POSITIVE_INFINITY,
    };

    const result = checkRouteCompatibility({
      model: invalidModel,
      origin: invalidOrigin,
      destination: invalidDestination,
    });

    expect(result.compatible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "invalid-range",
        "invalid-runway-requirement",
        "invalid-origin-runway",
        "invalid-destination-runway",
      ]),
    );
  });
});
