import { aircraftModelById, airportByIata } from "../data/indexes";
import type {
  Aircraft,
  AircraftModel,
  DemandEstimate,
  RouteDraft,
} from "../domain/types";
import { checkRouteCompatibility } from "./compatibility";
import { generateDailyODDemand } from "./demand";
import {
  calculateAircraftTripCost,
  calculateBreakEvenLoadFactor,
  calculateDailyAircraftFixedCost,
  calculateRouteRevenue,
  type CostBreakdown,
  type RevenueBreakdown,
} from "./economics";
import { calculateBlockTime, calculateDistanceKm } from "./geography";

const MAX_WEEKLY_FREQUENCY = 7;
const MAX_WEEKLY_UTILIZATION_HOURS = 112;
const MAX_SAFE_PRICE = Number.MAX_SAFE_INTEGER / 100;
const MAX_PRICE_YIELD_MULTIPLIER = 4;
const DEFAULT_DEPARTURE_TIME = "09:00";
const ANCILLARY_REVENUE_PER_PASSENGER = 24;
const CARGO_YIELD_PER_KG_KM = 0.00016;
const TARGET_LOAD_FACTOR = 0.84;

export type RoutePlannerErrorCode =
  | "missing-endpoints"
  | "identical-endpoints"
  | "unknown-airport"
  | "no-compatible-aircraft";

export class RoutePlannerError extends Error {
  readonly code: RoutePlannerErrorCode;

  constructor(code: RoutePlannerErrorCode, message: string) {
    super(message);
    this.name = "RoutePlannerError";
    this.code = code;
  }
}

export interface CreateRouteProposalInput {
  originIata: string;
  destinationIata: string;
  fleet: Aircraft[];
  date: string;
}

export type PlannerContext = CreateRouteProposalInput;

export interface RouteCostForecast extends CostBreakdown {
  lease: number;
}

export interface RouteForecast {
  distanceKm: number;
  blockTimeHours: number;
  weeklyUtilizationHours: number;
  availableSeatsPerFlight: number;
  expectedPassengersPerFlight: number;
  weeklyPassengers: number;
  costs: RouteCostForecast;
  revenue: RevenueBreakdown;
  profit: number;
  breakEvenLoadFactor: number;
}

export interface RouteProposal extends RouteDraft {
  demand: DemandEstimate;
  forecast: RouteForecast;
  reasons: string[];
  warnings: string[];
}

interface Candidate {
  aircraft: Aircraft;
  model: AircraftModel;
  weeklyFrequency: number;
  blockTimeHours: number;
  score: number;
}

interface ResolvedRoute {
  originIata: string;
  destinationIata: string;
  origin: NonNullable<ReturnType<typeof airportByIata.get>>;
  destination: NonNullable<ReturnType<typeof airportByIata.get>>;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const safeValue = Math.min(
    MAX_SAFE_PRICE,
    Math.max(-MAX_SAFE_PRICE, value),
  );

  return Math.round(safeValue * 100) / 100;
}

function resolveRoute(
  originInput: string,
  destinationInput: string,
): ResolvedRoute {
  const originIata = originInput?.trim().toUpperCase() ?? "";
  const destinationIata = destinationInput?.trim().toUpperCase() ?? "";

  if (!originIata || !destinationIata) {
    throw new RoutePlannerError(
      "missing-endpoints",
      "Select origin and destination",
    );
  }

  if (originIata === destinationIata) {
    throw new RoutePlannerError(
      "identical-endpoints",
      "Origin and destination must be different",
    );
  }

  const origin = airportByIata.get(originIata);
  const destination = airportByIata.get(destinationIata);

  if (!origin || !destination) {
    throw new RoutePlannerError("unknown-airport", "Unknown airport");
  }

  return { originIata, destinationIata, origin, destination };
}

function calculateSafeBlockTime(model: AircraftModel, route: ResolvedRoute) {
  return calculateBlockTime(
    calculateDistanceKm(route.origin.coordinates, route.destination.coordinates),
    model.cruiseSpeedKmh,
  );
}

function calculateRoundTripUtilizationHours(
  model: AircraftModel,
  route: ResolvedRoute,
) {
  const blockTimeHours = calculateSafeBlockTime(model, route);
  const turnaroundHours = Math.max(0, model.turnaroundMinutes) / 60;

  return blockTimeHours * 2 + turnaroundHours * 2;
}

function calculateAllocatedWeeklyLease(
  model: AircraftModel,
  aircraft: Aircraft,
  weeklyUtilizationHours: number,
) {
  const fullWeeklyLease =
    calculateDailyAircraftFixedCost({ model, aircraft }).total * 7;
  const utilizationShare = Math.min(
    1,
    Math.max(0, weeklyUtilizationHours) / MAX_WEEKLY_UTILIZATION_HOURS,
  );

  return fullWeeklyLease * utilizationShare;
}

function recommendFrequency(
  demand: DemandEstimate,
  model: AircraftModel,
  currentWeeklyUtilizationHours: number,
  roundTripUtilizationHours: number,
) {
  const seats = Math.max(1, model.economyCapacity + model.businessCapacity);
  const desired = clampInteger(
    Math.ceil((demand.total * 7) / (seats * TARGET_LOAD_FACTOR)),
    1,
    MAX_WEEKLY_FREQUENCY,
  );
  const remainingHours = Math.max(
    0,
    MAX_WEEKLY_UTILIZATION_HOURS - currentWeeklyUtilizationHours,
  );
  const utilizationLimit = Math.floor(
    remainingHours / roundTripUtilizationHours,
  );

  return Math.min(desired, MAX_WEEKLY_FREQUENCY, utilizationLimit);
}

function rankFleet(
  fleet: Aircraft[],
  route: ResolvedRoute,
  demand: DemandEstimate,
) {
  return fleet
    .map((aircraft): Candidate | undefined => {
      const model = aircraftModelById.get(aircraft.modelId);

      if (!model || model.role !== "passenger") {
        return undefined;
      }

      const currentWeeklyUtilizationHours = aircraft.utilizationHoursPerDay * 7;
      const blockTimeHours = calculateSafeBlockTime(model, route);
      const roundTripUtilizationHours = calculateRoundTripUtilizationHours(
        model,
        route,
      );
      const weeklyFrequency = recommendFrequency(
        demand,
        model,
        currentWeeklyUtilizationHours,
        roundTripUtilizationHours,
      );
      const proposedWeeklyUtilizationHours =
        roundTripUtilizationHours * weeklyFrequency;
      const compatibility = checkRouteCompatibility({
        model,
        origin: route.origin,
        destination: route.destination,
        aircraft: {
          available:
            Number.isFinite(aircraft.reliability) && aircraft.reliability > 0,
          currentWeeklyUtilizationHours,
          proposedWeeklyUtilizationHours,
          maxWeeklyUtilizationHours: MAX_WEEKLY_UTILIZATION_HOURS,
        },
      });

      if (weeklyFrequency < 1 || !compatibility.compatible) {
        return undefined;
      }

      const seats = model.economyCapacity + model.businessCapacity;
      const capacityGap = Math.abs(
        seats * weeklyFrequency -
          Math.min(demand.total * 7, seats * MAX_WEEKLY_FREQUENCY),
      );
      const allocatedLease = calculateAllocatedWeeklyLease(
        model,
        aircraft,
        proposedWeeklyUtilizationHours,
      );
      const score =
        capacityGap / Math.max(1, seats) +
        model.fuelBurnKgPerHour / Math.max(1, seats) +
        model.maintenancePerHour / Math.max(1, seats) +
        allocatedLease / Math.max(1, seats * weeklyFrequency);

      return { aircraft, model, weeklyFrequency, blockTimeHours, score };
    })
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.aircraft.id.localeCompare(second.aircraft.id),
    );
}

function operatingDaysForFrequency(frequency: number) {
  const uniqueDays = Math.min(frequency, 7);

  if (uniqueDays === 7) {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  return Array.from({ length: uniqueDays }, (_, index) =>
    Math.min(7, Math.floor((index * 7) / uniqueDays) + 1),
  );
}

function addCostBreakdowns(
  costs: CostBreakdown,
  frequency: number,
  lease: number,
): RouteCostForecast {
  const fuel = costs.fuel * frequency;
  const maintenance = costs.maintenance * frequency;
  const crew = costs.crew * frequency;
  const airportFees = costs.airportFees * frequency;
  const handlingNavigation = costs.handlingNavigation * frequency;

  return {
    fuel,
    maintenance,
    crew,
    airportFees,
    handlingNavigation,
    lease,
    total:
      fuel +
      maintenance +
      crew +
      airportFees +
      handlingNavigation +
      lease,
  };
}

function multiplyRevenue(
  revenue: RevenueBreakdown,
  frequency: number,
): RevenueBreakdown {
  const economyTickets = revenue.economyTickets * frequency;
  const businessTickets = revenue.businessTickets * frequency;
  const ancillaries = revenue.ancillaries * frequency;
  const bellyCargo = revenue.bellyCargo * frequency;

  return {
    economyTickets,
    businessTickets,
    ancillaries,
    bellyCargo,
    total: economyTickets + businessTickets + ancillaries + bellyCargo,
  };
}

function priceCaptureFactor(price: number, expectedYield: number) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(expectedYield) ||
    price <= 0 ||
    expectedYield <= 0
  ) {
    return 0;
  }

  return Math.min(1.2, (expectedYield / price) ** 2);
}

function calculateForecast(
  proposal: RouteDraft,
  aircraft: Aircraft,
  model: AircraftModel,
  route: ResolvedRoute,
  demand: DemandEstimate,
): RouteForecast {
  const distanceKm = calculateDistanceKm(
    route.origin.coordinates,
    route.destination.coordinates,
  );
  const blockTimeHours = calculateBlockTime(distanceKm, model.cruiseSpeedKmh);
  const weeklyUtilizationHours =
    calculateRoundTripUtilizationHours(model, route) * proposal.weeklyFrequency;
  const weeklyEconomyDemand =
    (demand.leisure + demand.vfr + demand.business * 0.25) *
    7 *
    priceCaptureFactor(proposal.economyPrice, demand.expectedEconomyYield);
  const weeklyBusinessDemand =
    demand.business *
    0.75 *
    7 *
    priceCaptureFactor(proposal.businessPrice, demand.expectedBusinessYield);
  const soldEconomySeats = Math.min(
    proposal.economySeats,
    Math.floor(weeklyEconomyDemand / proposal.weeklyFrequency),
  );
  const soldBusinessSeats = Math.min(
    proposal.businessSeats,
    Math.floor(weeklyBusinessDemand / proposal.weeklyFrequency),
  );
  const passengersPerFlight = soldEconomySeats + soldBusinessSeats;
  const tripCosts = calculateAircraftTripCost({
    model,
    origin: route.origin,
    destination: route.destination,
    configuredEconomySeats: proposal.economySeats,
    configuredBusinessSeats: proposal.businessSeats,
    passengers: passengersPerFlight,
    distanceKm,
    blockTimeHours,
  });
  const allocatedLease = calculateAllocatedWeeklyLease(
    model,
    aircraft,
    weeklyUtilizationHours,
  );
  const costs = addCostBreakdowns(
    tripCosts,
    proposal.weeklyFrequency,
    allocatedLease,
  );
  const tripRevenue = calculateRouteRevenue({
    model,
    configuredEconomySeats: proposal.economySeats,
    configuredBusinessSeats: proposal.businessSeats,
    soldEconomySeats,
    soldBusinessSeats,
    economyPrice: proposal.economyPrice,
    businessPrice: proposal.businessPrice,
    ancillaryRevenuePerPassenger: ANCILLARY_REVENUE_PER_PASSENGER,
    cargoKg: model.bellyCargoKg * 0.35,
    cargoYieldPerKgKm: CARGO_YIELD_PER_KG_KM,
    distanceKm,
  });
  const revenue = multiplyRevenue(tripRevenue, proposal.weeklyFrequency);
  const availableSeatsPerFlight =
    proposal.economySeats + proposal.businessSeats;
  const averageYieldPerSoldSeat =
    passengersPerFlight > 0
      ? (tripRevenue.economyTickets +
          tripRevenue.businessTickets +
          tripRevenue.ancillaries) /
        passengersPerFlight
      : 0;

  return {
    distanceKm,
    blockTimeHours,
    weeklyUtilizationHours,
    availableSeatsPerFlight,
    expectedPassengersPerFlight: passengersPerFlight,
    weeklyPassengers: passengersPerFlight * proposal.weeklyFrequency,
    costs,
    revenue,
    profit: revenue.total - costs.total,
    breakEvenLoadFactor: calculateBreakEvenLoadFactor({
      costs: costs.total,
      averageYieldPerSoldSeat,
      totalAvailableSeats:
        availableSeatsPerFlight * proposal.weeklyFrequency,
    }),
  };
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeDays(days: number[], frequency: number, warnings: string[]) {
  const expectedCount = Math.min(frequency, 7);
  const validDays = [
    ...new Set(
      days.filter(
        (day) => Number.isInteger(day) && Number.isFinite(day) && day >= 1 && day <= 7,
      ),
    ),
  ].sort((first, second) => first - second);

  if (validDays.length !== expectedCount) {
    warnings.push("Operating days were normalized to match weekly frequency.");
    return operatingDaysForFrequency(frequency);
  }

  return validDays;
}

function normalizePositivePrice(
  value: number,
  fallback: number,
  label: string,
  warnings: string[],
) {
  if (!Number.isFinite(value) || value <= 0) {
    warnings.push(`${label} price was reset to the expected market yield.`);
    return roundMoney(Math.max(1, fallback));
  }

  const plausibleMaximum = Math.min(
    MAX_SAFE_PRICE,
    Math.max(1, fallback) * MAX_PRICE_YIELD_MULTIPLIER,
  );

  if (value > plausibleMaximum) {
    warnings.push(`${label} price was normalized to a plausible market maximum.`);
    return roundMoney(plausibleMaximum);
  }

  return roundMoney(value);
}

function normalizeSeats(
  value: number,
  capacity: number,
  label: string,
  warnings: string[],
) {
  const normalized = clampInteger(value, 0, capacity);

  if (normalized !== value) {
    warnings.push(`${label} seats were normalized to aircraft capacity.`);
  }

  return normalized;
}

function proposalForCandidate(
  candidate: Candidate,
  route: ResolvedRoute,
  demand: DemandEstimate,
  warnings: string[] = [],
): RouteProposal {
  const economySeats = candidate.model.economyCapacity;
  const businessSeats = candidate.model.businessCapacity;
  const draft: RouteDraft = {
    originIata: route.originIata,
    destinationIata: route.destinationIata,
    aircraftId: candidate.aircraft.id,
    weeklyFrequency: candidate.weeklyFrequency,
    operatingDays: operatingDaysForFrequency(candidate.weeklyFrequency),
    departureTime: DEFAULT_DEPARTURE_TIME,
    economySeats,
    businessSeats,
    economyPrice: roundMoney(Math.max(1, demand.expectedEconomyYield)),
    businessPrice: roundMoney(Math.max(1, demand.expectedBusinessYield)),
  };

  if (candidate.aircraft.acquisitionType === "leased") {
    warnings.push("Forecast allocates lease by this route's utilization share.");
  }

  return {
    ...draft,
    demand,
    forecast: calculateForecast(
      draft,
      candidate.aircraft,
      candidate.model,
      route,
      demand,
    ),
    reasons: [
      `${candidate.model.name} is compatible and already in the player fleet.`,
      `Frequency matches estimated demand and available aircraft utilization.`,
      `Prices follow expected economy and business yields for this route.`,
    ],
    warnings,
  };
}

export function createRouteProposal(
  input: CreateRouteProposalInput,
): RouteProposal {
  const route = resolveRoute(input.originIata, input.destinationIata);
  const demand = generateDailyODDemand(
    input.date,
    route.origin,
    route.destination,
  );
  const [candidate] = rankFleet(input.fleet, route, demand);

  if (!candidate) {
    throw new RoutePlannerError(
      "no-compatible-aircraft",
      "No compatible aircraft in player fleet",
    );
  }

  return proposalForCandidate(candidate, route, demand);
}

export function recalculateRouteProposal(
  draft: RouteDraft | RouteProposal,
  context: PlannerContext,
): RouteProposal {
  const route = resolveRoute(context.originIata, context.destinationIata);
  const demand = generateDailyODDemand(
    context.date,
    route.origin,
    route.destination,
  );
  const warnings: string[] = [];
  const requestedAircraft = context.fleet.find(
    (aircraft) => aircraft.id === draft.aircraftId,
  );
  const requestedModel = requestedAircraft
    ? aircraftModelById.get(requestedAircraft.modelId)
    : undefined;
  const requestedCompatibility =
    requestedAircraft && requestedModel
      ? checkRouteCompatibility({
          model: requestedModel,
          origin: route.origin,
          destination: route.destination,
          aircraft: {
            available:
              Number.isFinite(requestedAircraft.reliability) &&
              requestedAircraft.reliability > 0,
            currentWeeklyUtilizationHours:
              requestedAircraft.utilizationHoursPerDay * 7,
          },
        })
      : undefined;
  let aircraft = requestedAircraft;
  let model = requestedModel;

  if (!aircraft || !model || !requestedCompatibility?.compatible) {
    const [fallback] = rankFleet(context.fleet, route, demand);

    if (!fallback) {
      throw new RoutePlannerError(
        "no-compatible-aircraft",
        "No compatible aircraft in player fleet",
      );
    }

    warnings.push("Aircraft selection was reset to a compatible fleet aircraft.");
    aircraft = fallback.aircraft;
    model = fallback.model;
  }

  const requestedWeeklyFrequency = clampInteger(
    draft.weeklyFrequency,
    1,
    MAX_WEEKLY_FREQUENCY,
  );

  if (Number.isFinite(draft.weeklyFrequency) && draft.weeklyFrequency > 7) {
    warnings.push(
      "Weekly frequency was normalized to one departure per operating day.",
    );
  } else if (requestedWeeklyFrequency !== draft.weeklyFrequency) {
    warnings.push("Weekly frequency was normalized to the 1-7 range.");
  }

  const currentWeeklyUtilization = aircraft.utilizationHoursPerDay * 7;
  const roundTripUtilizationHours = calculateRoundTripUtilizationHours(
    model,
    route,
  );
  const availableUtilizationHours = Math.max(
    0,
    MAX_WEEKLY_UTILIZATION_HOURS - currentWeeklyUtilization,
  );
  const utilizationFrequencyLimit = Math.floor(
    availableUtilizationHours / roundTripUtilizationHours,
  );

  if (utilizationFrequencyLimit < 1) {
    throw new RoutePlannerError(
      "no-compatible-aircraft",
      "Selected aircraft has no available utilization for this route",
    );
  }

  const weeklyFrequency = Math.min(
    requestedWeeklyFrequency,
    utilizationFrequencyLimit,
  );

  if (weeklyFrequency !== requestedWeeklyFrequency) {
    warnings.push(
      "Weekly frequency was normalized to available aircraft utilization.",
    );
  }

  const economySeats = normalizeSeats(
    draft.economySeats,
    model.economyCapacity,
    "Economy",
    warnings,
  );
  let businessSeats = normalizeSeats(
    draft.businessSeats,
    model.businessCapacity,
    "Business",
    warnings,
  );
  let normalizedEconomySeats = economySeats;

  if (normalizedEconomySeats + businessSeats === 0) {
    normalizedEconomySeats = Math.max(1, model.economyCapacity);
    businessSeats = 0;
    warnings.push("At least one passenger seat is required.");
  }

  const departureTime = isValidTime(draft.departureTime)
    ? draft.departureTime
    : DEFAULT_DEPARTURE_TIME;

  if (departureTime !== draft.departureTime) {
    warnings.push("Departure time was reset to a valid time.");
  }

  const normalizedDraft: RouteDraft = {
    originIata: route.originIata,
    destinationIata: route.destinationIata,
    aircraftId: aircraft.id,
    weeklyFrequency,
    operatingDays: normalizeDays(
      draft.operatingDays,
      weeklyFrequency,
      warnings,
    ),
    departureTime,
    economySeats: normalizedEconomySeats,
    businessSeats,
    economyPrice: normalizePositivePrice(
      draft.economyPrice,
      demand.expectedEconomyYield,
      "Economy",
      warnings,
    ),
    businessPrice: normalizePositivePrice(
      draft.businessPrice,
      demand.expectedBusinessYield,
      "Business",
      warnings,
    ),
  };
  return {
    ...normalizedDraft,
    demand,
    forecast: calculateForecast(
      normalizedDraft,
      aircraft,
      model,
      route,
      demand,
    ),
    reasons: [
      "Forecast recalculated from the player's selected route and manual settings.",
    ],
    warnings,
  };
}
