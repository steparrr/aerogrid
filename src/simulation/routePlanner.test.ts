import { describe, expect, it } from "vitest";

import type { Aircraft } from "../domain/types";
import { leased787Fixture } from "../test/fixtures";
import {
  createRouteProposal,
  recalculateRouteProposal,
} from "./routePlanner";

const date = "2027-03-18";

function aircraft(
  id: string,
  modelId: string,
  overrides: Partial<Aircraft> = {},
): Aircraft {
  return {
    id,
    modelId,
    acquisitionType: "owned",
    ageYears: 2,
    reliability: 0.98,
    assignedRouteIds: [],
    utilizationHoursPerDay: 0,
    ...overrides,
  };
}

function longHaulContext() {
  return {
    date,
    fleet: [
      aircraft("atr-in-fleet", "atr-72-600"),
      aircraft("freighter-in-fleet", "boeing-767f"),
      leased787Fixture(),
      aircraft("overutilized-a350", "airbus-a350-900", {
        utilizationHoursPerDay: 16,
      }),
    ],
  };
}

function expectFiniteNumbers(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(expectFiniteNumbers);
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach(expectFiniteNumbers);
  }
}

describe("route planner", () => {
  it("requires origin and destination selected by the player", () => {
    expect(() =>
      createRouteProposal({
        originIata: "",
        destinationIata: "",
        fleet: [],
        date,
      }),
    ).toThrow("Select origin and destination");
  });

  it("rejects identical and unknown endpoints", () => {
    expect(() =>
      createRouteProposal({
        originIata: "FCO",
        destinationIata: "FCO",
        fleet: [],
        date,
      }),
    ).toThrow("Origin and destination must be different");

    expect(() =>
      createRouteProposal({
        originIata: "FCO",
        destinationIata: "ZZZ",
        fleet: [],
        date,
      }),
    ).toThrow("Unknown airport");
  });

  it("recommends only a compatible passenger aircraft already in the player's fleet", () => {
    const proposal = createRouteProposal({
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    });

    expect(proposal.aircraftId).toBe("aircraft-test-787");
    expect(proposal.originIata).toBe("FCO");
    expect(proposal.destinationIata).toBe("JFK");
  });

  it("returns an explicit outcome when the fleet has no compatible aircraft", () => {
    expect(() =>
      createRouteProposal({
        originIata: "FCO",
        destinationIata: "JFK",
        fleet: [
          aircraft("atr-in-fleet", "atr-72-600"),
          aircraft("freighter-in-fleet", "boeing-767f"),
        ],
        date,
      }),
    ).toThrow("No compatible aircraft in player fleet");
  });

  it("creates a deterministic, practical, complete proposal", () => {
    const input = {
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    };
    const first = createRouteProposal(input);
    const second = createRouteProposal(input);

    expect(first).toEqual(second);
    expect(first.weeklyFrequency).toBeGreaterThanOrEqual(1);
    expect(first.weeklyFrequency).toBeLessThanOrEqual(14);
    expect(first.operatingDays.length).toBe(
      Math.min(first.weeklyFrequency, 7),
    );
    expect(new Set(first.operatingDays).size).toBe(first.operatingDays.length);
    expect(first.operatingDays.every((day) => day >= 1 && day <= 7)).toBe(true);
    expect(first.departureTime).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    expect(first.economyPrice).toBeGreaterThan(0);
    expect(first.businessPrice).toBeGreaterThan(0);
    expect(first.demand.total).toBeGreaterThan(0);
    expect(first.reasons.length).toBeGreaterThan(0);
    expect(first.forecast.costs.total).toBeGreaterThan(0);
    expect(first.forecast.revenue.total).toBeGreaterThan(0);
    expectFiniteNumbers(first);
  });

  it("preserves endpoints and recalculates manual price, frequency, class, and aircraft edits", () => {
    const context = {
      date,
      fleet: [
        leased787Fixture(),
        aircraft("owned-a350", "airbus-a350-900"),
      ],
    };
    const original = createRouteProposal({
      originIata: "FCO",
      destinationIata: "JFK",
      ...context,
    });
    const edited = recalculateRouteProposal(
      {
        ...original,
        originIata: "DXB",
        destinationIata: "SIN",
        aircraftId: "owned-a350",
        weeklyFrequency: 14,
        operatingDays: [7, 6, 5, 4, 3, 2, 1],
        departureTime: "22:35",
        economySeats: 180,
        businessSeats: 35,
        economyPrice: original.economyPrice * 1.4,
        businessPrice: original.businessPrice * 1.25,
      },
      {
        ...context,
        originIata: original.originIata,
        destinationIata: original.destinationIata,
      },
    );

    expect(edited.originIata).toBe("FCO");
    expect(edited.destinationIata).toBe("JFK");
    expect(edited.aircraftId).toBe("owned-a350");
    expect(edited.weeklyFrequency).toBe(14);
    expect(edited.departureTime).toBe("22:35");
    expect(edited.economySeats).toBe(180);
    expect(edited.businessSeats).toBe(35);
    expect(edited.forecast.profit).not.toBe(original.forecast.profit);
    expect(edited.forecast.availableSeatsPerFlight).toBe(215);
    expectFiniteNumbers(edited);
  });

  it("normalizes invalid manual edits with clear warnings instead of NaN", () => {
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: Number.POSITIVE_INFINITY,
        operatingDays: [0, 8, 8, Number.NaN],
        departureTime: "99:99",
        economySeats: -50,
        businessSeats: Number.NaN,
        economyPrice: -1,
        businessPrice: Number.POSITIVE_INFINITY,
      },
      context,
    );

    expect(edited.originIata).toBe("FCO");
    expect(edited.destinationIata).toBe("JFK");
    expect(edited.weeklyFrequency).toBeGreaterThanOrEqual(1);
    expect(edited.weeklyFrequency).toBeLessThanOrEqual(14);
    expect(edited.departureTime).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    expect(edited.economySeats).toBeGreaterThanOrEqual(0);
    expect(edited.businessSeats).toBeGreaterThanOrEqual(0);
    expect(edited.economyPrice).toBeGreaterThan(0);
    expect(edited.businessPrice).toBeGreaterThan(0);
    expect(edited.warnings.length).toBeGreaterThan(0);
    expectFiniteNumbers(edited);
  });

  it("does not expose an alternative destination field or API", () => {
    const proposal = createRouteProposal({
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    });
    const serialized = JSON.stringify(proposal).toLowerCase();

    expect(serialized).not.toContain("alternative");
    expect(serialized).not.toContain("suggesteddestination");
  });
});
