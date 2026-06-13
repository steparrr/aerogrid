import { describe, expect, it } from "vitest";

import type { Route } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import {
  BOOKING_CURVES,
  adjustFareClasses,
  buildFareClasses,
  calculateBidPrice,
  calculateOverbookingLevel,
  evaluateBookingPace,
  projectFlightRevenue,
} from "./yieldEngine";

function routeFixture(overrides: Partial<Route> = {}): Route {
  return {
    ...playableStateFixture().routes[0],
    load_factor: 0.45,
    pricing_strategy: "COMPETITOR_MATCH",
    overbooking_level: "MODERATE",
    ...overrides,
  };
}

describe("yield engine", () => {
  it("provides immutable 90-day booking curves for every route profile", () => {
    expect(Object.keys(BOOKING_CURVES)).toEqual([
      "LEISURE",
      "BUSINESS",
      "MIXED",
      "VFR",
    ]);

    for (const curve of Object.values(BOOKING_CURVES)) {
      expect(curve).toHaveLength(90);
      expect(curve[0]).toBeLessThan(curve[89] ?? 0);
      expect(curve.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });

  it("evaluates booking pace against the inferred route curve", () => {
    expect(evaluateBookingPace(routeFixture({ load_factor: 0.7 }), 30)).toBe(
      "AHEAD",
    );
    expect(evaluateBookingPace(routeFixture({ load_factor: 0.45 }), 30)).toBe(
      "ON_TRACK",
    );
    expect(evaluateBookingPace(routeFixture({ load_factor: 0.2 }), 30)).toBe(
      "BEHIND",
    );
  });

  it("opens or protects fare classes according to pace and strategy", () => {
    const route = routeFixture({ pricing_strategy: "YIELD_MAXIMIZER" });
    const snapshot = structuredClone(route);

    const behind = adjustFareClasses(route, "BEHIND");
    const ahead = adjustFareClasses(route, "AHEAD");

    expect(route).toEqual(snapshot);
    expect(behind.open_classes).toEqual(
      expect.arrayContaining(["Q", "K", "L"]),
    );
    expect(behind.flash_sale_recommended).toBe(true);
    expect(ahead.close_classes).toEqual(
      expect.arrayContaining(["Q", "K", "L"]),
    );
    expect(ahead.classes.find((fareClass) => fareClass.code === "Y")?.is_open).toBe(
      true,
    );
    expect(ahead.classes.find((fareClass) => fareClass.code === "J")?.is_open).toBe(
      true,
    );
  });

  it("builds every documented fare class in cabin order", () => {
    expect(buildFareClasses(routeFixture()).map((fareClass) => fareClass.code)).toEqual([
      "Q",
      "K",
      "L",
      "M",
      "H",
      "B",
      "Y",
      "I",
      "D",
      "C",
      "J",
      "G",
      "W",
      "F",
      "A",
    ]);
  });

  it("raises bid price with scarcity and respects premium strategy floors", () => {
    const normal = calculateBidPrice(
      routeFixture({ load_factor: 0.4 }),
      { year: 2027, month: 3 },
    );
    const scarce = calculateBidPrice(
      routeFixture({ load_factor: 0.9 }),
      { year: 2027, month: 3 },
    );
    const premium = calculateBidPrice(
      routeFixture({
        load_factor: 0.1,
        pricing_strategy: "PREMIUM",
        economyPrice: 620,
      }),
      { year: 2027, month: 3 },
    );

    expect(scarce).toBeGreaterThan(normal);
    expect(premium).toBeGreaterThanOrEqual(620);
  });

  it("calculates optimal overbooking from route mix and selected risk level", () => {
    const conservative = calculateOverbookingLevel(
      routeFixture({
        economySeats: 92,
        businessSeats: 8,
        overbooking_level: "CONSERVATIVE",
      }),
    );
    const aggressive = calculateOverbookingLevel(
      routeFixture({
        economySeats: 92,
        businessSeats: 8,
        overbooking_level: "AGGRESSIVE",
      }),
    );

    expect(conservative).toBeGreaterThan(0);
    expect(aggressive).toBeGreaterThan(conservative);
    expect(
      calculateOverbookingLevel(routeFixture({ overbooking_level: "OFF" })),
    ).toBe(0);
  });

  it("projects final passengers and revenue without mutating the route", () => {
    const route = routeFixture({
      load_factor: 0.3,
      pricing_strategy: "LOAD_MAXIMIZER",
    });
    const snapshot = structuredClone(route);

    const projection = projectFlightRevenue(route);

    expect(route).toEqual(snapshot);
    expect(projection.projected_load_factor).toBeGreaterThan(route.load_factor ?? 0);
    expect(projection.projected_passengers).toBeGreaterThan(0);
    expect(projection.average_fare).toBeGreaterThan(0);
    expect(projection.projected_revenue).toBeGreaterThan(0);
  });
});
