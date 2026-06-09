import { aircraftModelById, airportByIata } from "../data/indexes";
import type {
  Aircraft,
  DailyFinancialReport,
  DemandEstimate,
  GameNotification,
  GameState,
  NpcAirline,
  Route,
  RoutePerformance,
  WeeklyFinancialReport,
} from "../domain/types";

export const AUTOSAVE_KEY = "aerogrid-autosave-v1";
const GAME_VIEWS = new Set([
  "operations",
  "market",
  "airports",
  "planner",
  "routes",
  "fleet",
  "finance",
  "contracts",
  "debug",
]);

interface SaveEnvelope {
  schemaVersion: 1;
  savedAt: string;
  game: GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidDate(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRoutePerformance(value: unknown): value is RoutePerformance {
  return (
    isRecord(value) &&
    isValidDate(value.date) &&
    isFiniteNonNegative(value.passengers) &&
    isFiniteNonNegative(value.loadFactor) &&
    value.loadFactor <= 1 &&
    isFiniteNonNegative(value.revenue) &&
    isFiniteNonNegative(value.costs) &&
    isFiniteNumber(value.profit) &&
    isFiniteNonNegative(value.availableSeatKm)
  );
}

function isAircraft(value: unknown): value is Aircraft {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.modelId === "string" &&
    aircraftModelById.has(value.modelId) &&
    (value.acquisitionType === "owned" || value.acquisitionType === "leased") &&
    isFiniteNonNegative(value.ageYears) &&
    isFiniteNonNegative(value.reliability) &&
    value.reliability <= 1 &&
    isStringArray(value.assignedRouteIds) &&
    isFiniteNonNegative(value.utilizationHoursPerDay)
  );
}

function isRoute(
  value: unknown,
  aircraftById: ReadonlyMap<string, Aircraft>,
): value is Route {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.originIata !== "string" ||
    typeof value.destinationIata !== "string" ||
    value.originIata === value.destinationIata ||
    !airportByIata.has(value.originIata) ||
    !airportByIata.has(value.destinationIata) ||
    typeof value.aircraftId !== "string" ||
    !aircraftById.has(value.aircraftId) ||
    typeof value.weeklyFrequency !== "number" ||
    !Number.isInteger(value.weeklyFrequency) ||
    !Array.isArray(value.operatingDays) ||
    typeof value.departureTime !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.departureTime) ||
    typeof value.economySeats !== "number" ||
    !Number.isInteger(value.economySeats) ||
    typeof value.businessSeats !== "number" ||
    !Number.isInteger(value.businessSeats) ||
    !isFiniteNumber(value.economyPrice) ||
    value.economyPrice <= 0 ||
    !isFiniteNumber(value.businessPrice) ||
    value.businessPrice <= 0 ||
    (value.status !== "active" && value.status !== "suspended") ||
    !Array.isArray(value.performanceHistory) ||
    !value.performanceHistory.every(isRoutePerformance)
  ) {
    return false;
  }

  const aircraft = aircraftById.get(value.aircraftId);
  const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
  const operatingDays = value.operatingDays as unknown[];

  return (
    Boolean(model) &&
    value.weeklyFrequency >= 1 &&
    value.weeklyFrequency <= 7 &&
    operatingDays.length === value.weeklyFrequency &&
    new Set(operatingDays).size === operatingDays.length &&
    operatingDays.every(
      (day) => Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 7,
    ) &&
    value.economySeats >= 0 &&
    value.businessSeats >= 0 &&
    value.economySeats + value.businessSeats >= 1 &&
    value.economySeats <= (model?.economyCapacity ?? 0) &&
    value.businessSeats <= (model?.businessCapacity ?? 0)
  );
}

function isDemandEstimate(value: unknown): value is DemandEstimate {
  return (
    isRecord(value) &&
    isFiniteNonNegative(value.business) &&
    isFiniteNonNegative(value.leisure) &&
    isFiniteNonNegative(value.vfr) &&
    isFiniteNonNegative(value.total) &&
    isFiniteNonNegative(value.expectedEconomyYield) &&
    isFiniteNonNegative(value.expectedBusinessYield) &&
    isFiniteNonNegative(value.seasonality)
  );
}

function isNpcAirline(value: unknown): value is NpcAirline {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.hubIata === "string" &&
    airportByIata.has(value.hubIata) &&
    isFiniteNonNegative(value.reputation) &&
    value.reputation <= 1 &&
    isFiniteNumber(value.priceBias) &&
    value.priceBias >= 0.5 &&
    value.priceBias <= 1.5 &&
    isFiniteNumber(value.frequencyBias) &&
    value.frequencyBias >= 0.5 &&
    value.frequencyBias <= 1.5
  );
}

function isDailyReport(value: unknown): value is DailyFinancialReport {
  return (
    isRecord(value) &&
    isValidDate(value.date) &&
    isFiniteNonNegative(value.passengers) &&
    isFiniteNonNegative(value.revenue) &&
    isFiniteNonNegative(value.costs) &&
    isFiniteNumber(value.profit) &&
    isFiniteNonNegative(value.cask) &&
    isFiniteNonNegative(value.rask) &&
    isFiniteNumber(value.operatingMargin) &&
    Array.isArray(value.routeResults) &&
    value.routeResults.every(isRoutePerformance)
  );
}

function isWeeklyReport(value: unknown): value is WeeklyFinancialReport {
  return (
    isRecord(value) &&
    isValidDate(value.startDate) &&
    isValidDate(value.endDate) &&
    isFiniteNonNegative(value.passengers) &&
    isFiniteNonNegative(value.revenue) &&
    isFiniteNonNegative(value.costs) &&
    isFiniteNumber(value.profit) &&
    isFiniteNumber(value.operatingMargin)
  );
}

function isNotification(value: unknown): value is GameNotification {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.severity === "info" ||
      value.severity === "warning" ||
      value.severity === "error") &&
    typeof value.title === "string" &&
    typeof value.message === "string"
  );
}

function hasUniqueIds(values: readonly { id: string }[]) {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

export function validateGameState(value: unknown): value is GameState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isValidDate(value.currentDate) ||
    typeof value.airlineName !== "string" ||
    value.airlineName.trim().length < 2 ||
    typeof value.hubIata !== "string" ||
    !airportByIata.has(value.hubIata) ||
    !isFiniteNumber(value.cash) ||
    !isFiniteNonNegative(value.reputation) ||
    value.reputation > 1 ||
    !Array.isArray(value.fleet) ||
    !value.fleet.every(isAircraft) ||
    !Array.isArray(value.routes) ||
    !Array.isArray(value.npcAirlines) ||
    value.npcAirlines.length !== 8 ||
    !value.npcAirlines.every(isNpcAirline) ||
    !isRecord(value.reports) ||
    !Array.isArray(value.reports.daily) ||
    !value.reports.daily.every(isDailyReport) ||
    !Array.isArray(value.reports.weekly) ||
    !value.reports.weekly.every(isWeeklyReport) ||
    !Array.isArray(value.notifications) ||
    !value.notifications.every(isNotification) ||
    typeof value.currentView !== "string" ||
    !GAME_VIEWS.has(value.currentView) ||
    !isRecord(value.debug) ||
    !isStringArray(value.debug.errors) ||
    !isStringArray(value.debug.npcEvents) ||
    !Array.isArray(value.debug.lastDemand) ||
    !value.debug.lastDemand.every(isDemandEstimate)
  ) {
    return false;
  }

  const fleet = value.fleet as Aircraft[];
  const aircraftById = new Map(fleet.map((aircraft) => [aircraft.id, aircraft]));
  const routesValid = value.routes.every((route) => isRoute(route, aircraftById));

  if (!hasUniqueIds(fleet) || !routesValid) {
    return false;
  }

  const routes = value.routes as Route[];
  const routeIds = new Set(routes.map(({ id }) => id));

  return (
    hasUniqueIds(routes) &&
    routes.every((route) =>
      fleet
        .find((aircraft) => aircraft.id === route.aircraftId)
        ?.assignedRouteIds.includes(route.id),
    ) &&
    fleet.every((aircraft) =>
      aircraft.assignedRouteIds.every(
        (routeId) =>
          routeIds.has(routeId) &&
          routes.some(
            (route) => route.id === routeId && route.aircraftId === aircraft.id,
          ),
      ),
    )
  );
}

export function serializeGame(
  game: GameState,
  savedAt = new Date().toISOString(),
) {
  const envelope: SaveEnvelope = {
    schemaVersion: 1,
    savedAt,
    game,
  };

  return JSON.stringify(envelope);
}

export function deserializeGame(serialized: string): GameState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Invalid save file");
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== 1) {
    throw new Error("Unsupported save schema");
  }

  if (
    typeof parsed.savedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.savedAt))
  ) {
    throw new Error("Invalid save file");
  }

  if (!validateGameState(parsed.game)) {
    throw new Error("Invalid game state");
  }

  return parsed.game;
}

export function saveGameLocally(
  game: GameState,
  storage: Storage = localStorage,
) {
  storage.setItem(AUTOSAVE_KEY, serializeGame(game));
}

export function loadAutosavedGame(storage: Storage = localStorage) {
  const serialized = storage.getItem(AUTOSAVE_KEY);

  if (!serialized) {
    return null;
  }

  try {
    return deserializeGame(serialized);
  } catch {
    return null;
  }
}

export function createGameExport(game: GameState) {
  return new Blob([serializeGame(game)], { type: "application/json" });
}
