import { aircraftModelById, airportByIata } from "../data/indexes";
import type {
  DailyFinancialReport,
  DemandEstimate,
  GameNotification,
  GameState,
  NpcAirline,
  Route,
  RoutePerformance,
  WeeklyFinancialReport,
} from "../domain/types";
import { checkRouteCompatibility } from "./compatibility";
import { generateDailyODDemand } from "./demand";
import {
  calculateAircraftTripCost,
  calculateCask,
  calculateDailyAircraftFixedCost,
  calculateRask,
  calculateRouteRevenue,
} from "./economics";
import { calculateBlockTime, calculateDistanceKm } from "./geography";
import { processNpcDay } from "./npc";

const LEGS_PER_ROTATION = 2;
const ANCILLARY_REVENUE_PER_PASSENGER = 24;
const CARGO_YIELD_PER_KG_KM = 0.00016;
const MAX_DAYS_PER_ADVANCE = 365;

interface SimulatedRouteDay {
  performance: RoutePerformance;
  demand?: DemandEstimate;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(value: string, days: number) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function isoDayOfWeek(value: string) {
  const date = parseDate(value);

  if (!date) {
    return 0;
  }

  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundMetric(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function operatingMargin(revenue: number, profit: number) {
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return profit < 0 ? -1 : 0;
  }

  return Number.isFinite(profit) ? profit / revenue : 0;
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

function competitorStrength(
  npcAirlines: readonly NpcAirline[],
  route: Route,
) {
  return npcAirlines
    .filter(
      (npc) =>
        npc.hubIata === route.originIata ||
        npc.hubIata === route.destinationIata,
    )
    .reduce((total, npc) => {
      const priceBias = Math.max(0.1, finiteNonNegative(npc.priceBias));
      return (
        total +
        finiteNonNegative(npc.reputation) *
          finiteNonNegative(npc.frequencyBias) *
          (1 / priceBias)
      );
    }, 0);
}

function playerMarketShare(
  route: Route,
  playerReputation: number,
  npcAirlines: readonly NpcAirline[],
) {
  const playerStrength =
    Math.max(0.1, finiteNonNegative(playerReputation)) *
    (0.75 + Math.min(7, finiteNonNegative(route.weeklyFrequency)) / 28);
  const totalStrength = playerStrength + competitorStrength(npcAirlines, route);

  return totalStrength > 0 ? playerStrength / totalStrength : 1;
}

function zeroPerformance(date: string): RoutePerformance {
  return {
    date,
    passengers: 0,
    loadFactor: 0,
    revenue: 0,
    costs: 0,
    profit: 0,
    availableSeatKm: 0,
  };
}

function simulateRouteDay(
  state: GameState,
  route: Route,
  dayOfWeek: number,
): SimulatedRouteDay {
  if (route.status !== "active" || !route.operatingDays.includes(dayOfWeek)) {
    return { performance: zeroPerformance(state.currentDate) };
  }

  const aircraft = state.fleet.find((item) => item.id === route.aircraftId);
  const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
  const origin = airportByIata.get(route.originIata);
  const destination = airportByIata.get(route.destinationIata);

  if (!aircraft || !model || !origin || !destination) {
    return { performance: zeroPerformance(state.currentDate) };
  }

  const demand = generateDailyODDemand(state.currentDate, origin, destination);
  const marketShare = playerMarketShare(
    route,
    state.reputation,
    state.npcAirlines,
  );
  const economyDemand =
    (demand.leisure + demand.vfr + demand.business * 0.25) *
    priceCaptureFactor(route.economyPrice, demand.expectedEconomyYield) *
    marketShare;
  const businessDemand =
    demand.business *
    0.75 *
    priceCaptureFactor(route.businessPrice, demand.expectedBusinessYield) *
    marketShare;
  const soldEconomySeats = Math.min(
    Math.max(0, Math.floor(route.economySeats)),
    Math.max(0, Math.floor(economyDemand)),
  );
  const soldBusinessSeats = Math.min(
    Math.max(0, Math.floor(route.businessSeats)),
    Math.max(0, Math.floor(businessDemand)),
  );
  const passengersPerLeg = soldEconomySeats + soldBusinessSeats;
  const distanceKm = calculateDistanceKm(
    origin.coordinates,
    destination.coordinates,
  );
  const blockTimeHours = calculateBlockTime(
    distanceKm,
    model.cruiseSpeedKmh,
  );
  const oneLegCosts = calculateAircraftTripCost({
    model,
    origin,
    destination,
    configuredEconomySeats: route.economySeats,
    configuredBusinessSeats: route.businessSeats,
    passengers: passengersPerLeg,
    distanceKm,
    blockTimeHours,
  });
  const oneLegRevenue = calculateRouteRevenue({
    model,
    configuredEconomySeats: route.economySeats,
    configuredBusinessSeats: route.businessSeats,
    soldEconomySeats,
    soldBusinessSeats,
    economyPrice: route.economyPrice,
    businessPrice: route.businessPrice,
    ancillaryRevenuePerPassenger: ANCILLARY_REVENUE_PER_PASSENGER,
    cargoKg: model.bellyCargoKg * 0.35,
    cargoYieldPerKgKm: CARGO_YIELD_PER_KG_KM,
    distanceKm,
  });
  const passengers = passengersPerLeg * LEGS_PER_ROTATION;
  const availableSeats =
    Math.max(0, route.economySeats + route.businessSeats) * LEGS_PER_ROTATION;
  const revenue = oneLegRevenue.total * LEGS_PER_ROTATION;
  const costs = oneLegCosts.total * LEGS_PER_ROTATION;

  return {
    demand,
    performance: {
      date: state.currentDate,
      passengers,
      loadFactor: availableSeats > 0 ? passengers / availableSeats : 0,
      revenue,
      costs,
      profit: revenue - costs,
      availableSeatKm: availableSeats * distanceKm,
    },
  };
}

function validateState(state: GameState) {
  const errors: string[] = [];
  const fleetById = new Map(state.fleet.map((aircraft) => [aircraft.id, aircraft]));

  if (!parseDate(state.currentDate)) {
    errors.push(`Invalid current date: ${state.currentDate}`);
  }

  if (!Number.isFinite(state.cash)) {
    errors.push("Invalid cash balance");
  }

  for (const aircraft of state.fleet) {
    if (!aircraftModelById.has(aircraft.modelId)) {
      errors.push(`Unknown aircraft model: ${aircraft.modelId}`);
    }
  }

  for (const route of state.routes) {
    const aircraft = fleetById.get(route.aircraftId);
    const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
    const origin = airportByIata.get(route.originIata);
    const destination = airportByIata.get(route.destinationIata);

    if (!aircraft) {
      errors.push(`Route ${route.id} references missing-aircraft ${route.aircraftId}`);
      continue;
    }

    if (!model) {
      errors.push(`Route ${route.id} references unknown model ${aircraft.modelId}`);
      continue;
    }

    if (!origin || !destination || origin.iata === destination.iata) {
      errors.push(`Route ${route.id} has invalid endpoints`);
      continue;
    }

    const compatibility = checkRouteCompatibility({
      model,
      origin,
      destination,
      aircraft: { available: aircraft.reliability > 0 },
    });

    if (!compatibility.compatible) {
      errors.push(
        `Route ${route.id} is not operable: ${compatibility.reasons.join(", ")}`,
      );
    }

    if (
      !Number.isInteger(route.weeklyFrequency) ||
      route.weeklyFrequency < 1 ||
      route.weeklyFrequency > 7 ||
      new Set(route.operatingDays).size !== route.operatingDays.length ||
      route.operatingDays.length !== route.weeklyFrequency ||
      route.operatingDays.some(
        (day) => !Number.isInteger(day) || day < 1 || day > 7,
      )
    ) {
      errors.push(`Route ${route.id} has an invalid schedule`);
    }

    if (
      !Number.isInteger(route.economySeats) ||
      route.economySeats < 0 ||
      route.economySeats > model.economyCapacity ||
      !Number.isInteger(route.businessSeats) ||
      route.businessSeats < 0 ||
      route.businessSeats > model.businessCapacity ||
      route.economySeats + route.businessSeats < 1 ||
      !Number.isFinite(route.economyPrice) ||
      route.economyPrice <= 0 ||
      !Number.isFinite(route.businessPrice) ||
      route.businessPrice <= 0
    ) {
      errors.push(`Route ${route.id} has invalid economics`);
    }
  }

  return errors;
}

function interruptionState(
  state: GameState,
  errors: string[],
  message: string,
): GameState {
  const notification: GameNotification = {
    id: `turn-error-${state.currentDate}-${state.debug.errors.length}`,
    severity: "error",
    title: "Simulation interrupted",
    message,
  };

  return {
    ...state,
    notifications: [...state.notifications, notification],
    debug: {
      ...state.debug,
      errors: [...state.debug.errors, ...errors],
    },
  };
}

function npcEvents(before: readonly NpcAirline[], after: readonly NpcAirline[]) {
  return after.map((npc, index) => {
    const previous = before[index];
    return `${npc.name}: price ${previous?.priceBias ?? 1} -> ${npc.priceBias}, frequency ${previous?.frequencyBias ?? 1} -> ${npc.frequencyBias}`;
  });
}

function createDailyReport(
  date: string,
  routeResults: RoutePerformance[],
  fixedCosts: number,
): DailyFinancialReport {
  const passengers = routeResults.reduce(
    (total, result) => total + result.passengers,
    0,
  );
  const revenue = routeResults.reduce(
    (total, result) => total + result.revenue,
    0,
  );
  const variableCosts = routeResults.reduce(
    (total, result) => total + result.costs,
    0,
  );
  const availableSeatKm = routeResults.reduce(
    (total, result) => total + result.availableSeatKm,
    0,
  );
  const costs = variableCosts + fixedCosts;
  const profit = revenue - costs;

  return {
    date,
    passengers,
    revenue,
    costs,
    profit,
    cask: calculateCask(costs, availableSeatKm),
    rask: calculateRask(revenue, availableSeatKm),
    operatingMargin: operatingMargin(revenue, profit),
    routeResults,
  };
}

function createWeeklyReport(
  dailyReports: readonly DailyFinancialReport[],
): WeeklyFinancialReport {
  const passengers = dailyReports.reduce(
    (total, report) => total + report.passengers,
    0,
  );
  const revenue = dailyReports.reduce(
    (total, report) => total + report.revenue,
    0,
  );
  const costs = dailyReports.reduce(
    (total, report) => total + report.costs,
    0,
  );
  const profit = revenue - costs;

  return {
    startDate: dailyReports[0]?.date ?? "",
    endDate: dailyReports.at(-1)?.date ?? "",
    passengers,
    revenue,
    costs,
    profit,
    operatingMargin: operatingMargin(revenue, profit),
  };
}

export function advanceOneDay(state: GameState): GameState {
  const validationErrors = validateState(state);

  if (validationErrors.length > 0) {
    return interruptionState(
      state,
      validationErrors,
      `The daily turn could not start: ${validationErrors.join("; ")}`,
    );
  }

  const dayOfWeek = isoDayOfWeek(state.currentDate);
  const simulatedRoutes = state.routes.map((route) =>
    simulateRouteDay(state, route, dayOfWeek),
  );
  const routeResults = simulatedRoutes.map(({ performance }) => performance);
  const fixedCosts = state.fleet.reduce((total, aircraft) => {
    const model = aircraftModelById.get(aircraft.modelId);
    return (
      total +
      (model
        ? calculateDailyAircraftFixedCost({ model, aircraft }).total
        : 0)
    );
  }, 0);
  const report = createDailyReport(state.currentDate, routeResults, fixedCosts);
  const dailyReports = [...state.reports.daily, report];
  const weeklyReports =
    dailyReports.length % 7 === 0
      ? [
          ...state.reports.weekly,
          createWeeklyReport(dailyReports.slice(-7)),
        ]
      : state.reports.weekly;
  const nextNpcAirlines = processNpcDay(state.npcAirlines, state.currentDate);
  const nextNpcEvents = npcEvents(state.npcAirlines, nextNpcAirlines);
  const notification: GameNotification = {
    id: `turn-${state.currentDate}`,
    severity: report.profit >= 0 ? "info" : "warning",
    title: `Daily report: ${state.currentDate}`,
    message: `${report.passengers} passengers, profit ${roundMetric(report.profit)}`,
  };

  return {
    ...state,
    currentDate: addCalendarDays(state.currentDate, 1),
    cash: state.cash + report.profit,
    routes: state.routes.map((route, index) => ({
      ...route,
      performanceHistory: [
        ...route.performanceHistory,
        routeResults[index] ?? zeroPerformance(state.currentDate),
      ],
    })),
    npcAirlines: nextNpcAirlines,
    reports: {
      daily: dailyReports,
      weekly: weeklyReports,
    },
    notifications: [...state.notifications, notification],
    debug: {
      ...state.debug,
      npcEvents: [...state.debug.npcEvents, ...nextNpcEvents],
      lastDemand: simulatedRoutes.flatMap(({ demand }) =>
        demand ? [demand] : [],
      ),
    },
  };
}

export function advanceDays(state: GameState, requestedDays: number): GameState {
  if (!Number.isFinite(requestedDays) || requestedDays <= 0) {
    return state;
  }

  const days = Math.min(MAX_DAYS_PER_ADVANCE, Math.floor(requestedDays));
  let nextState = state;
  let processedDays = 0;

  for (let index = 0; index < days; index += 1) {
    const previousDate = nextState.currentDate;
    const advanced = advanceOneDay(nextState);

    if (advanced.currentDate === previousDate) {
      const reason =
        advanced.debug.errors.at(-1) ?? "Unknown critical validation error";
      return interruptionState(
        advanced,
        [],
        `Processed ${processedDays} of ${days} days before interruption: ${reason}`,
      );
    }

    nextState = advanced;
    processedDays += 1;
  }

  return nextState;
}
