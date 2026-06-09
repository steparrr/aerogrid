import { describe, expect, it } from "vitest";

import { aircraftModelById, airportByIata } from "../data/indexes";
import type { Aircraft } from "../domain/types";
import {
  calculateAircraftTripCost,
  calculateBreakEvenLoadFactor,
  calculateCask,
  calculateRask,
  calculateRouteProfit,
  calculateRouteRevenue,
} from "./economics";

const model = aircraftModelById.get("boeing-787-9")!;
const origin = airportByIata.get("FCO")!;
const destination = airportByIata.get("JFK")!;
const ownedAircraft: Pick<Aircraft, "acquisitionType"> = {
  acquisitionType: "owned",
};
const leasedAircraft: Pick<Aircraft, "acquisitionType"> = {
  acquisitionType: "leased",
};

function expectFiniteNonNegativeBreakdown(breakdown: object) {
  for (const value of Object.values(breakdown) as number[]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
}

describe("route economics", () => {
  it("raises revenue when more configured seats are sold", () => {
    const baseInput = {
      model,
      configuredEconomySeats: 240,
      configuredBusinessSeats: 30,
      economyPrice: 620,
      businessPrice: 2_400,
      ancillaryRevenuePerPassenger: 28,
      cargoKg: 4_000,
      cargoYieldPerKgKm: 0.00018,
      distanceKm: 6_900,
    };

    const lowerRevenue = calculateRouteRevenue({
      ...baseInput,
      soldEconomySeats: 80,
      soldBusinessSeats: 10,
    });
    const higherRevenue = calculateRouteRevenue({
      ...baseInput,
      soldEconomySeats: 180,
      soldBusinessSeats: 20,
    });

    expect(higherRevenue.total).toBeGreaterThan(lowerRevenue.total);
  });

  it("bounds sold seats by configured capacity and excludes negative sales", () => {
    const revenue = calculateRouteRevenue({
      model,
      configuredEconomySeats: 100,
      configuredBusinessSeats: 10,
      soldEconomySeats: 1_000,
      soldBusinessSeats: -5,
      economyPrice: 100,
      businessPrice: 500,
      ancillaryRevenuePerPassenger: 0,
      cargoKg: 0,
      cargoYieldPerKgKm: 0,
      distanceKm: 1_000,
    });

    expect(revenue.economyTickets).toBe(10_000);
    expect(revenue.businessTickets).toBe(0);
    expect(revenue.total).toBe(10_000);
  });

  it("adds a daily prorated lease charge only to leased trip costs", () => {
    const owned = calculateAircraftTripCost({
      model,
      aircraft: ownedAircraft,
      origin,
      destination,
    });
    const leased = calculateAircraftTripCost({
      model,
      aircraft: leasedAircraft,
      origin,
      destination,
    });

    expect(owned.lease).toBe(0);
    expect(leased.lease).toBeCloseTo(model.monthlyLease / 30);
    expect(leased.total - owned.total).toBeCloseTo(leased.lease);
  });

  it("returns complete finite economics and profit breakdowns", () => {
    const costs = calculateAircraftTripCost({
      model,
      aircraft: leasedAircraft,
      origin,
      destination,
    });
    const revenue = calculateRouteRevenue({
      model,
      configuredEconomySeats: 240,
      configuredBusinessSeats: 30,
      soldEconomySeats: 210,
      soldBusinessSeats: 25,
      economyPrice: 620,
      businessPrice: 2_400,
      ancillaryRevenuePerPassenger: 28,
      cargoKg: 4_000,
      cargoYieldPerKgKm: 0.00018,
      distanceKm: 6_900,
    });
    const estimate = calculateRouteProfit({ costs, revenue });
    const availableSeatKm = 270 * 6_900;
    const metrics = {
      cask: calculateCask(costs.total, availableSeatKm),
      rask: calculateRask(revenue.total, availableSeatKm),
      breakEven: calculateBreakEvenLoadFactor(costs.total, revenue.total),
    };

    expectFiniteNonNegativeBreakdown(costs);
    expectFiniteNonNegativeBreakdown(revenue);
    expect(estimate.costs).toEqual(costs);
    expect(estimate.revenue).toEqual(revenue);
    expect(Number.isFinite(estimate.profit)).toBe(true);
    expectFiniteNonNegativeBreakdown(metrics);
  });

  it("protects every output from negative and invalid numeric inputs", () => {
    const costs = calculateAircraftTripCost({
      model: {
        ...model,
        fuelBurnKgPerHour: -1,
        maintenancePerHour: Number.NaN,
        crewPerHour: Number.POSITIVE_INFINITY,
        monthlyLease: -1,
      },
      aircraft: leasedAircraft,
      origin: { ...origin, baseFees: -1, passengerFees: Number.NaN },
      destination: {
        ...destination,
        baseFees: Number.POSITIVE_INFINITY,
        passengerFees: -1,
      },
      distanceKm: -1,
      blockTimeHours: Number.NaN,
      fuelPricePerKg: -1,
    });
    const revenue = calculateRouteRevenue({
      model,
      configuredEconomySeats: -1,
      configuredBusinessSeats: Number.NaN,
      soldEconomySeats: Number.POSITIVE_INFINITY,
      soldBusinessSeats: -1,
      economyPrice: -1,
      businessPrice: Number.NaN,
      ancillaryRevenuePerPassenger: Number.POSITIVE_INFINITY,
      cargoKg: -1,
      cargoYieldPerKgKm: Number.NaN,
      distanceKm: Number.POSITIVE_INFINITY,
    });

    expectFiniteNonNegativeBreakdown(costs);
    expectFiniteNonNegativeBreakdown(revenue);
    expect(calculateCask(Number.NaN, 0)).toBe(0);
    expect(calculateRask(Number.POSITIVE_INFINITY, -1)).toBe(0);
    expect(calculateBreakEvenLoadFactor(100, 0)).toBe(1);
    expect(calculateBreakEvenLoadFactor(0, 0)).toBe(0);
  });

  it("saturates overflowing finite inputs instead of rolling them to zero", () => {
    const costs = calculateAircraftTripCost({
      model: {
        ...model,
        fuelBurnKgPerHour: Number.MAX_VALUE,
      },
      aircraft: ownedAircraft,
      origin,
      destination,
    });
    const revenue = calculateRouteRevenue({
      model,
      configuredEconomySeats: 100,
      configuredBusinessSeats: 0,
      soldEconomySeats: 100,
      soldBusinessSeats: 0,
      economyPrice: Number.MAX_VALUE,
      businessPrice: 0,
      ancillaryRevenuePerPassenger: 0,
      cargoKg: 0,
      cargoYieldPerKgKm: 0,
      distanceKm: 1_000,
    });

    expect(costs.fuel).toBeGreaterThan(0);
    expect(Number.isFinite(costs.fuel)).toBe(true);
    expect(revenue.economyTickets).toBeGreaterThan(0);
    expect(Number.isFinite(revenue.economyTickets)).toBe(true);
    expect(revenue.total).toBeGreaterThan(0);
    expect(Number.isFinite(revenue.total)).toBe(true);
  });
});
