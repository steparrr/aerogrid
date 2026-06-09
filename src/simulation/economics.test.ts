import { describe, expect, it } from "vitest";

import { aircraftModelById, airportByIata } from "../data/indexes";
import type { Aircraft } from "../domain/types";
import {
  calculateAircraftTripCost,
  calculateBreakEvenLoadFactor,
  calculateCask,
  calculateDailyAircraftFixedCost,
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
const standardTripContext = {
  configuredEconomySeats: 240,
  configuredBusinessSeats: 30,
  passengers: 235,
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

  it("charges lease once per aircraft day, not once per trip", () => {
    const firstTrip = calculateAircraftTripCost({
      model,
      origin,
      destination,
      ...standardTripContext,
    });
    const secondTrip = calculateAircraftTripCost({
      model,
      origin,
      destination,
      ...standardTripContext,
    });
    const dailyFixedCost = calculateDailyAircraftFixedCost({
      model,
      aircraft: leasedAircraft,
    });

    expect(firstTrip).toEqual(secondTrip);
    expect(dailyFixedCost.lease).toBeCloseTo(model.monthlyLease / 30);
    expect(firstTrip.total + secondTrip.total + dailyFixedCost.total).toBeCloseTo(
      firstTrip.total + secondTrip.total + model.monthlyLease / 30,
    );
  });

  it("charges fixed daily lease cost even when the aircraft is idle", () => {
    const leased = calculateDailyAircraftFixedCost({
      model,
      aircraft: leasedAircraft,
    });
    const owned = calculateDailyAircraftFixedCost({
      model,
      aircraft: ownedAircraft,
    });

    expect(leased.total).toBeCloseTo(model.monthlyLease / 30);
    expect(owned).toEqual({ lease: 0, total: 0 });
  });

  it("uses actual passengers for passenger fees", () => {
    const lowPassengers = calculateAircraftTripCost({
      model,
      origin,
      destination,
      ...standardTripContext,
      passengers: 50,
    });
    const highPassengers = calculateAircraftTripCost({
      model,
      origin,
      destination,
      ...standardTripContext,
      passengers: 200,
    });

    expect(highPassengers.airportFees).toBeGreaterThan(
      lowPassengers.airportFees,
    );
  });

  it("uses configured seats for handling instead of model maximum capacity", () => {
    const smallConfiguration = calculateAircraftTripCost({
      model,
      origin,
      destination,
      configuredEconomySeats: 100,
      configuredBusinessSeats: 10,
      passengers: 100,
    });
    const largeConfiguration = calculateAircraftTripCost({
      model,
      origin,
      destination,
      configuredEconomySeats: 240,
      configuredBusinessSeats: 30,
      passengers: 100,
    });

    expect(largeConfiguration.handlingNavigation).toBeGreaterThan(
      smallConfiguration.handlingNavigation,
    );
    expect(largeConfiguration.airportFees).toBe(smallConfiguration.airportFees);
  });

  it("returns complete finite economics and profit breakdowns", () => {
    const costs = calculateAircraftTripCost({
      model,
      origin,
      destination,
      ...standardTripContext,
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
      breakEven: calculateBreakEvenLoadFactor({
        costs: costs.total,
        averageYieldPerSoldSeat: 620,
        totalAvailableSeats: 270,
      }),
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
      origin: { ...origin, baseFees: -1, passengerFees: Number.NaN },
      destination: {
        ...destination,
        baseFees: Number.POSITIVE_INFINITY,
        passengerFees: -1,
      },
      distanceKm: -1,
      blockTimeHours: Number.NaN,
      fuelPricePerKg: -1,
      configuredEconomySeats: Number.POSITIVE_INFINITY,
      configuredBusinessSeats: -1,
      passengers: Number.NaN,
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
    const fixedCosts = calculateDailyAircraftFixedCost({
      model: { ...model, monthlyLease: Number.NaN },
      aircraft: leasedAircraft,
    });

    expectFiniteNonNegativeBreakdown(costs);
    expectFiniteNonNegativeBreakdown(revenue);
    expect(fixedCosts).toEqual({ lease: 0, total: 0 });
    expect(calculateCask(Number.NaN, 0)).toBe(0);
    expect(calculateRask(Number.POSITIVE_INFINITY, -1)).toBe(0);
    expect(
      calculateBreakEvenLoadFactor({
        costs: 100,
        averageYieldPerSoldSeat: 0,
        totalAvailableSeats: 100,
      }),
    ).toBe(1);
    expect(
      calculateBreakEvenLoadFactor({
        costs: Number.NaN,
        averageYieldPerSoldSeat: Number.POSITIVE_INFINITY,
        totalAvailableSeats: -1,
      }),
    ).toBe(0);
  });

  it("saturates overflowing finite inputs instead of rolling them to zero", () => {
    const costs = calculateAircraftTripCost({
      model: {
        ...model,
        fuelBurnKgPerHour: Number.MAX_VALUE,
      },
      origin,
      destination,
      ...standardTripContext,
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

  it("calculates break-even load factor from yield per seat and capacity", () => {
    expect(
      calculateBreakEvenLoadFactor({
        costs: 80_000,
        averageYieldPerSoldSeat: 500,
        totalAvailableSeats: 200,
      }),
    ).toBeCloseTo(0.8);
    expect(
      calculateBreakEvenLoadFactor({
        costs: 200_000,
        averageYieldPerSoldSeat: 500,
        totalAvailableSeats: 200,
      }),
    ).toBe(1);
  });

  it("sanitizes externally supplied profit breakdowns", () => {
    const estimate = calculateRouteProfit({
      costs: {
        fuel: Number.NaN,
        maintenance: -1,
        crew: Number.POSITIVE_INFINITY,
        airportFees: 10,
        handlingNavigation: 20,
        total: Number.NaN,
      },
      revenue: {
        economyTickets: Number.NaN,
        businessTickets: -1,
        ancillaries: Number.POSITIVE_INFINITY,
        bellyCargo: 30,
        total: Number.NaN,
      },
    });

    expectFiniteNonNegativeBreakdown(estimate.costs);
    expectFiniteNonNegativeBreakdown(estimate.revenue);
    expect(estimate.costs.total).toBe(30);
    expect(estimate.revenue.total).toBe(30);
    expect(estimate.profit).toBe(0);
  });
});
