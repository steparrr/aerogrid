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
import { synchronizeGameState } from "./stateSync";

export const AUTOSAVE_KEY = "aerogrid-autosave-v1";
const LEGACY_SAVE_KEY = "aerogrid_save_v1";
const GAME_VIEWS = new Set([
  "operations",
  "rotations",
  "yield",
  "route-study",
  "maintenance",
  "distribution",
  "staff",
  "progression",
  "missions",
  "market",
  "airports",
  "world-map",
  "airport-conceptual",
  "airport-physical",
  "terminal-map",
  "aircraft-catalog",
  "competitors",
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

const VALID_ACQUISITION_TYPES = new Set(["owned", "leased", "acmi", "sale_leaseback"]);

function isAircraft(value: unknown): value is Aircraft {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.modelId === "string" &&
    aircraftModelById.has(value.modelId) &&
    typeof value.acquisitionType === "string" &&
    VALID_ACQUISITION_TYPES.has(value.acquisitionType) &&
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
    // NPC hubs may be outside the player airport database (e.g. DAL)
    isFiniteNonNegative(value.reputation) &&
    value.reputation <= 1 &&
    isFiniteNumber(value.priceBias) &&
    value.priceBias > 0 &&
    isFiniteNumber(value.frequencyBias) &&
    value.frequencyBias > 0
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

function debugFail(reason: string, detail?: unknown): false {
  console.error("[AeroGrid save] Validation failed:", reason, detail ?? "");
  return false;
}

export function validateGameState(value: unknown): value is GameState {
  if (!isRecord(value))                              return debugFail("not a record");
  if (value.schemaVersion !== 1)                     return debugFail("schemaVersion", value.schemaVersion);
  if (!isValidDate(value.currentDate))               return debugFail("currentDate", value.currentDate);
  if (typeof value.airlineName !== "string" || value.airlineName.trim().length < 2)
                                                     return debugFail("airlineName", value.airlineName);
  if (typeof value.hubIata !== "string" || !airportByIata.has(value.hubIata))
                                                     return debugFail("hubIata", value.hubIata);
  if (!isFiniteNumber(value.cash))                   return debugFail("cash", value.cash);
  if (!isFiniteNonNegative(value.reputation) || value.reputation > 1)
                                                     return debugFail("reputation", value.reputation);
  if (!Array.isArray(value.fleet))                   return debugFail("fleet not array");

  // Filtra gli aerei invalidi invece di far saltare tutto
  const badAircraft = (value.fleet as unknown[]).filter(a => !isAircraft(a));
  if (badAircraft.length > 0) {
    console.error("[AeroGrid save] Invalid aircraft (will reject save):", badAircraft);
    return debugFail(`${badAircraft.length} aircraft invalid`);
  }

  if (!Array.isArray(value.routes))                  return debugFail("routes not array");
  if (!Array.isArray(value.npcAirlines))             return debugFail("npcAirlines not array");
  if (value.npcAirlines.length === 0)                return debugFail("npcAirlines empty");

  const badNpc = (value.npcAirlines as unknown[]).filter(n => !isNpcAirline(n));
  if (badNpc.length > 0)                             return debugFail(`${badNpc.length} npcAirlines invalid`, badNpc[0]);

  if (!isRecord(value.reports))                      return debugFail("reports not record");
  if (!Array.isArray(value.reports.daily))           return debugFail("reports.daily not array");

  const badDaily = (value.reports.daily as unknown[]).filter(r => !isDailyReport(r));
  if (badDaily.length > 0)                           return debugFail(`${badDaily.length} daily reports invalid`);

  if (!Array.isArray(value.reports.weekly))          return debugFail("reports.weekly not array");

  const badWeekly = (value.reports.weekly as unknown[]).filter(r => !isWeeklyReport(r));
  if (badWeekly.length > 0)                          return debugFail(`${badWeekly.length} weekly reports invalid`);

  if (!Array.isArray(value.notifications))           return debugFail("notifications not array");

  const badNotif = (value.notifications as unknown[]).filter(n => !isNotification(n));
  if (badNotif.length > 0)                           return debugFail(`${badNotif.length} notifications invalid`);

  if (typeof value.currentView !== "string")         return debugFail("currentView not string");
  if (!GAME_VIEWS.has(value.currentView))            return debugFail("currentView unknown", value.currentView);

  if (!isRecord(value.debug))                        return debugFail("debug not record");
  if (!isStringArray(value.debug.errors))            return debugFail("debug.errors not string[]");
  if (!isStringArray(value.debug.npcEvents))         return debugFail("debug.npcEvents not string[]");
  // lastDemand is optional — skip if missing
  if (Array.isArray(value.debug.lastDemand)) {
    const badDemand = (value.debug.lastDemand as unknown[]).filter(d => !isDemandEstimate(d));
    if (badDemand.length > 0)                        return debugFail(`${badDemand.length} demand estimates invalid`);
  }

  const fleet = value.fleet as Aircraft[];
  const aircraftById = new Map(fleet.map((aircraft) => [aircraft.id, aircraft]));

  if (!hasUniqueIds(fleet))                          return debugFail("fleet has duplicate ids");

  const badRoutes = (value.routes as unknown[]).filter(r => !isRoute(r, aircraftById));
  if (badRoutes.length > 0) {
    console.error("[AeroGrid save] Invalid routes:", badRoutes);
    return debugFail(`${badRoutes.length} routes invalid`);
  }

  const routes = value.routes as Route[];
  const routeIds = new Set(routes.map(({ id }) => id));

  if (!hasUniqueIds(routes))                         return debugFail("routes has duplicate ids");

  const routesMissingFromAircraft = routes.filter(route =>
    !fleet.find(ac => ac.id === route.aircraftId)?.assignedRouteIds.includes(route.id)
  );
  if (routesMissingFromAircraft.length > 0)          return debugFail("routes not in aircraft.assignedRouteIds", routesMissingFromAircraft.map(r => r.id));

  const orphanAssignments = fleet.flatMap(ac =>
    ac.assignedRouteIds.filter(rid =>
      !routeIds.has(rid) || !routes.some(r => r.id === rid && r.aircraftId === ac.id)
    ).map(rid => `${ac.id}:${rid}`)
  );
  if (orphanAssignments.length > 0)                  return debugFail("orphan assignedRouteIds", orphanAssignments);

  console.log("[AeroGrid save] Validation OK — fleet:", fleet.length, "routes:", routes.length);
  return true;
}

export function serializeGame(
  game: GameState,
  savedAt = new Date().toISOString(),
) {
  // Exclude static/derived fields that can be rebuilt on load to keep save size small
  const { airports: _airports, player: _player, competitors: _competitors, ...saveable } = game;
  void _airports; void _player; void _competitors;

  const envelope: SaveEnvelope = {
    schemaVersion: 1,
    savedAt,
    game: saveable as GameState,
  };

  const serialized = JSON.stringify(envelope);
  console.log(`[AeroGrid save] Salvataggio: ${(serialized.length / 1024).toFixed(1)} KB`);
  return serialized;
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

  return synchronizeGameState(parsed.game);
}

export function saveGameLocally(
  game: GameState,
  storage: Storage = localStorage,
) {
  storage.setItem(AUTOSAVE_KEY, serializeGame(game));
}

export function loadAutosavedGame(storage: Storage = localStorage) {
  try {
    const serialized = storage.getItem(AUTOSAVE_KEY);

    if (!serialized) {
      console.warn("[AeroGrid save] No save found in localStorage (key:", AUTOSAVE_KEY, ")");
      (window as Record<string, unknown>).__aerogrid_load_error = "Nessun save trovato";
      return null;
    }

    console.log("[AeroGrid save] Save found, size:", serialized.length, "bytes. Deserializing…");
    const result = deserializeGame(serialized);
    console.log("[AeroGrid save] Load successful.");
    (window as Record<string, unknown>).__aerogrid_load_error = null;
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AeroGrid save] Exception during load:", e);
    (window as Record<string, unknown>).__aerogrid_load_error = msg;
    return null;
  }
}

export function createGameExport(game: GameState) {
  return new Blob([serializeGame(game)], { type: "application/json" });
}

export function saveGame(game: GameState): void {
  try {
    saveGameLocally(game);
  } catch {
    // The active in-memory game remains valid if storage is unavailable.
  }
}

export function loadGame(): GameState | null {
  const autosaved = loadAutosavedGame();

  if (autosaved) {
    return autosaved;
  }

  try {
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    const parsed: unknown = legacy ? JSON.parse(legacy) : null;

    if (!validateGameState(parsed)) {
      return null;
    }

    const migrated = synchronizeGameState(parsed);
    saveGame(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // Storage may be unavailable; deletion is best effort.
  }
}
