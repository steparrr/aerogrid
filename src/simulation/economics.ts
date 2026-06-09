import type { Aircraft, AircraftModel, Airport } from "../domain/types";
import { calculateBlockTime, calculateDistanceKm } from "./geography";

const DEFAULT_FUEL_PRICE_PER_KG = 1.05;
const DAYS_PER_MONTH = 30;
const HANDLING_PER_SEAT = 16;
const NAVIGATION_PER_KM = 0.72;
const SAFE_NUMERIC_LIMIT = Number.MAX_SAFE_INTEGER;

export interface CostBreakdown {
  fuel: number;
  maintenance: number;
  crew: number;
  airportFees: number;
  handlingNavigation: number;
  lease: number;
  total: number;
}

export interface RevenueBreakdown {
  economyTickets: number;
  businessTickets: number;
  ancillaries: number;
  bellyCargo: number;
  total: number;
}

export interface AircraftTripCostInput {
  model: AircraftModel;
  aircraft: Pick<Aircraft, "acquisitionType">;
  origin: Airport;
  destination: Airport;
  distanceKm?: number;
  blockTimeHours?: number;
  fuelPricePerKg?: number;
}

export interface RouteRevenueInput {
  model: AircraftModel;
  configuredEconomySeats: number;
  configuredBusinessSeats: number;
  soldEconomySeats: number;
  soldBusinessSeats: number;
  economyPrice: number;
  businessPrice: number;
  ancillaryRevenuePerPassenger: number;
  cargoKg: number;
  cargoYieldPerKgKm: number;
  distanceKm: number;
}

export interface RouteFinancialEstimate {
  costs: CostBreakdown;
  revenue: RevenueBreakdown;
  profit: number;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0
    ? Math.min(value, SAFE_NUMERIC_LIMIT)
    : 0;
}

function safeMultiply(...values: number[]) {
  return values.reduce((product, value) => {
    const safeValue = finiteNonNegative(value);

    if (product === 0 || safeValue === 0) {
      return 0;
    }

    return product > SAFE_NUMERIC_LIMIT / safeValue
      ? SAFE_NUMERIC_LIMIT
      : product * safeValue;
  }, 1);
}

function safeAdd(...values: number[]) {
  return values.reduce(
    (total, value) =>
      Math.min(SAFE_NUMERIC_LIMIT, total + finiteNonNegative(value)),
    0,
  );
}

function boundedSeats(value: number, capacity: number) {
  return Math.min(
    Math.floor(finiteNonNegative(value)),
    Math.floor(finiteNonNegative(capacity)),
  );
}

function resolveDistanceKm(input: AircraftTripCostInput) {
  return input.distanceKm === undefined
    ? calculateDistanceKm(
        input.origin.coordinates,
        input.destination.coordinates,
      )
    : finiteNonNegative(input.distanceKm);
}

function resolveBlockTimeHours(
  input: AircraftTripCostInput,
  distanceKm: number,
) {
  if (input.blockTimeHours !== undefined) {
    return finiteNonNegative(input.blockTimeHours);
  }

  const cruiseSpeedKmh = finiteNonNegative(input.model.cruiseSpeedKmh);
  return cruiseSpeedKmh > 0
    ? calculateBlockTime(distanceKm, cruiseSpeedKmh)
    : 0;
}

export function calculateAircraftTripCost(
  input: AircraftTripCostInput,
): CostBreakdown {
  const { model, aircraft, origin, destination } = input;
  const distanceKm = resolveDistanceKm(input);
  const blockTimeHours = resolveBlockTimeHours(input, distanceKm);
  const fuelPricePerKg =
    input.fuelPricePerKg === undefined
      ? DEFAULT_FUEL_PRICE_PER_KG
      : finiteNonNegative(input.fuelPricePerKg);
  const configuredCapacity = safeAdd(
    model.economyCapacity,
    model.businessCapacity,
  );

  const fuel = safeMultiply(
    model.fuelBurnKgPerHour,
    blockTimeHours,
    fuelPricePerKg,
  );
  const maintenance = safeMultiply(model.maintenancePerHour, blockTimeHours);
  const crew = safeMultiply(model.crewPerHour, blockTimeHours);
  const airportFees = safeAdd(
    origin.baseFees,
    destination.baseFees,
    safeMultiply(
      safeAdd(origin.passengerFees, destination.passengerFees),
      configuredCapacity,
    ),
  );
  const handlingNavigation = safeAdd(
    safeMultiply(configuredCapacity, HANDLING_PER_SEAT),
    safeMultiply(distanceKm, NAVIGATION_PER_KM),
  );
  const lease =
    aircraft.acquisitionType === "leased"
      ? finiteNonNegative(model.monthlyLease) / DAYS_PER_MONTH
      : 0;

  return {
    fuel,
    maintenance,
    crew,
    airportFees,
    handlingNavigation,
    lease,
    total: safeAdd(
      fuel,
      maintenance,
      crew,
      airportFees,
      handlingNavigation,
      lease,
    ),
  };
}

export function calculateRouteRevenue(
  input: RouteRevenueInput,
): RevenueBreakdown {
  const configuredEconomySeats = boundedSeats(
    input.configuredEconomySeats,
    input.model.economyCapacity,
  );
  const configuredBusinessSeats = boundedSeats(
    input.configuredBusinessSeats,
    input.model.businessCapacity,
  );
  const soldEconomySeats = boundedSeats(
    input.soldEconomySeats,
    configuredEconomySeats,
  );
  const soldBusinessSeats = boundedSeats(
    input.soldBusinessSeats,
    configuredBusinessSeats,
  );
  const passengers = safeAdd(soldEconomySeats, soldBusinessSeats);
  const cargoKg = Math.min(
    finiteNonNegative(input.cargoKg),
    finiteNonNegative(input.model.bellyCargoKg),
  );

  const economyTickets = safeMultiply(soldEconomySeats, input.economyPrice);
  const businessTickets = safeMultiply(soldBusinessSeats, input.businessPrice);
  const ancillaries = safeMultiply(
    passengers,
    input.ancillaryRevenuePerPassenger,
  );
  const bellyCargo = safeMultiply(
    cargoKg,
    input.distanceKm,
    input.cargoYieldPerKgKm,
  );

  return {
    economyTickets,
    businessTickets,
    ancillaries,
    bellyCargo,
    total: safeAdd(
      economyTickets,
      businessTickets,
      ancillaries,
      bellyCargo,
    ),
  };
}

export function calculateRouteProfit({
  costs,
  revenue,
}: {
  costs: CostBreakdown;
  revenue: RevenueBreakdown;
}): RouteFinancialEstimate {
  const profit =
    finiteNonNegative(revenue.total) - finiteNonNegative(costs.total);

  return {
    costs,
    revenue,
    profit: Number.isFinite(profit) ? profit : 0,
  };
}

function calculatePerAvailableSeatKm(value: number, availableSeatKm: number) {
  const safeAvailableSeatKm = finiteNonNegative(availableSeatKm);

  if (safeAvailableSeatKm === 0) {
    return 0;
  }

  return finiteNonNegative(finiteNonNegative(value) / safeAvailableSeatKm);
}

export function calculateCask(costs: number, availableSeatKm: number) {
  return calculatePerAvailableSeatKm(costs, availableSeatKm);
}

export function calculateRask(revenue: number, availableSeatKm: number) {
  return calculatePerAvailableSeatKm(revenue, availableSeatKm);
}

export function calculateBreakEvenLoadFactor(
  costs: number,
  yieldAtFullLoad: number,
) {
  const safeCosts = finiteNonNegative(costs);
  const safeYieldAtFullLoad = finiteNonNegative(yieldAtFullLoad);

  if (safeYieldAtFullLoad === 0) {
    return safeCosts === 0 ? 0 : 1;
  }

  return Math.min(1, finiteNonNegative(safeCosts / safeYieldAtFullLoad));
}
