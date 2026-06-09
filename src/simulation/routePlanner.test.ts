import { describe, expect, it } from "vitest";

import { aircraftModelById } from "../data/indexes";
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
    expect(first.weeklyFrequency).toBeLessThanOrEqual(7);
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
        weeklyFrequency: 7,
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
    expect(edited.weeklyFrequency).toBeLessThanOrEqual(7);
    expect(
      edited.forecast.weeklyUtilizationHours,
    ).toBeLessThanOrEqual(112);
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
    expect(edited.weeklyFrequency).toBeLessThanOrEqual(7);
    expect(edited.departureTime).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    expect(edited.economySeats).toBeGreaterThanOrEqual(0);
    expect(edited.businessSeats).toBeGreaterThanOrEqual(0);
    expect(edited.economyPrice).toBeGreaterThan(0);
    expect(edited.businessPrice).toBeGreaterThan(0);
    expect(edited.warnings.length).toBeGreaterThan(0);
    expectFiniteNumbers(edited);
  });

  it("normalizes a huge finite manual economy price to a finite safe price", () => {
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        economyPrice: Number.MAX_VALUE,
      },
      context,
    );

    expect(edited.economyPrice).toBeGreaterThan(0);
    expect(Number.isFinite(edited.economyPrice)).toBe(true);
    expect(edited.economyPrice).toBeLessThanOrEqual(
      edited.demand.expectedEconomyYield * 4,
    );
    expect(edited.warnings).toContain(
      "Economy price was normalized to a plausible market maximum.",
    );
    expectFiniteNumbers(edited);
  });

  it("normalizes a huge finite manual business price to a finite safe price", () => {
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        businessPrice: Number.MAX_VALUE,
      },
      context,
    );

    expect(edited.businessPrice).toBeGreaterThan(0);
    expect(Number.isFinite(edited.businessPrice)).toBe(true);
    expect(edited.businessPrice).toBeLessThanOrEqual(
      edited.demand.expectedBusinessYield * 4,
    );
    expect(edited.warnings).toContain(
      "Business price was normalized to a plausible market maximum.",
    );
    expectFiniteNumbers(edited);
  });

  it("normalizes manual frequency to the selected aircraft's available utilization", () => {
    const selectedAircraft = aircraft("busy-a350", "airbus-a350-900", {
      utilizationHoursPerDay: 12,
    });
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      date,
      fleet: [selectedAircraft],
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: 7,
        operatingDays: [1, 2, 3, 4, 5, 6, 7],
      },
      context,
    );

    expect(edited.originIata).toBe("FCO");
    expect(edited.destinationIata).toBe("JFK");
    expect(edited.aircraftId).toBe(selectedAircraft.id);
    expect(edited.weeklyFrequency).toBeLessThan(7);
    expect(
      selectedAircraft.utilizationHoursPerDay * 7 +
        edited.forecast.weeklyUtilizationHours,
    ).toBeLessThanOrEqual(112);
    expect(edited.warnings).toContain(
      "Weekly frequency was normalized to available aircraft utilization.",
    );
  });

  it("normalizes a single departure schedule to at most seven weekly flights", () => {
    const context = {
      originIata: "FCO",
      destinationIata: "LHR",
      date,
      fleet: [aircraft("a320", "airbus-a320neo")],
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: 14,
        operatingDays: [1, 2, 3, 4, 5, 6, 7],
      },
      context,
    );

    expect(edited.weeklyFrequency).toBe(7);
    expect(edited.operatingDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(edited.warnings).toContain(
      "Weekly frequency was normalized to one departure per operating day.",
    );
  });

  it("includes two legs and turnaround time in weekly utilization", () => {
    const model = aircraftModelById.get("airbus-a320neo")!;
    const context = {
      originIata: "FCO",
      destinationIata: "LHR",
      date,
      fleet: [aircraft("a320", model.id)],
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: 3,
        operatingDays: [1, 3, 5],
      },
      context,
    );
    const expectedRoundTripHours =
      edited.forecast.blockTimeHours * 2 + (model.turnaroundMinutes / 60) * 2;

    expect(edited.forecast.weeklyUtilizationHours).toBeCloseTo(
      expectedRoundTripHours * 3,
    );
  });

  it("allocates lease cost proportionally across partial-use proposals", () => {
    const model = aircraftModelById.get("boeing-787-9")!;
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      date,
      fleet: [leased787Fixture()],
    };
    const original = createRouteProposal(context);
    const oneFlight = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: 1,
        operatingDays: [1],
      },
      context,
    );
    const twoFlights = recalculateRouteProposal(
      {
        ...original,
        weeklyFrequency: 2,
        operatingDays: [1, 4],
      },
      context,
    );
    const fullWeeklyLease = (model.monthlyLease / 30) * 7;

    expect(oneFlight.forecast.costs.lease).toBeLessThan(fullWeeklyLease);
    expect(twoFlights.forecast.costs.lease).toBeLessThan(fullWeeklyLease);
    expect(
      oneFlight.forecast.costs.lease + twoFlights.forecast.costs.lease,
    ).toBeLessThan(fullWeeklyLease);
    expect(twoFlights.forecast.costs.lease).toBeCloseTo(
      oneFlight.forecast.costs.lease * 2,
    );
  });

  it("accounts for allocated lease cost when ranking identical candidates", () => {
    const proposal = createRouteProposal({
      originIata: "FCO",
      destinationIata: "LHR",
      date,
      fleet: [
        aircraft("a-leased", "airbus-a320neo", {
          acquisitionType: "leased",
        }),
        aircraft("z-owned", "airbus-a320neo"),
      ],
    });

    expect(proposal.aircraftId).toBe("z-owned");
  });

  it("caps extreme prices and lets passenger demand approach zero", () => {
    const context = {
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    };
    const original = createRouteProposal(context);
    const edited = recalculateRouteProposal(
      {
        ...original,
        economyPrice: Number.MAX_VALUE,
        businessPrice: Number.MAX_VALUE,
      },
      context,
    );

    expect(edited.forecast.weeklyPassengers).toBeLessThan(
      original.forecast.weeklyPassengers * 0.15,
    );
    expect(edited.forecast.profit).toBeLessThan(original.forecast.profit);
  });

  it("calculates passenger break-even yield without fixed cargo revenue", () => {
    const proposal = createRouteProposal({
      originIata: "FCO",
      destinationIata: "JFK",
      ...longHaulContext(),
    });
    const passengerRevenue =
      proposal.forecast.revenue.total - proposal.forecast.revenue.bellyCargo;
    const passengerYield =
      passengerRevenue / proposal.forecast.weeklyPassengers;
    const expectedBreakEven = Math.min(
      1,
      proposal.forecast.costs.total /
        (passengerYield *
          proposal.forecast.availableSeatsPerFlight *
          proposal.weeklyFrequency),
    );

    expect(proposal.forecast.breakEvenLoadFactor).toBeCloseTo(expectedBreakEven);
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
