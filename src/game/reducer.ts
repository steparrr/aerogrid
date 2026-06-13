import { aircraftModelById, airportByIata } from "../data/indexes";
import type {
  AcquisitionInput,
  Aircraft,
  GameEvent,
  GameState,
  GameView,
  NewGameInput,
  Route,
  RouteDraft,
  RouteStatus,
  RouteUpdate,
  SlotAsset,
} from "../domain/types";
import { processTurn } from "../engine/turnEngine";
import { advanceDays } from "../simulation/advance";
import { checkRouteCompatibility } from "../simulation/compatibility";
import { calculateBlockTime, calculateDistanceKm } from "../simulation/geography";
import { createNewGame } from "./initialState";
import { validateGameState } from "./persistence";
import { synchronizeGameState } from "./stateSync";

const MAX_WEEKLY_UTILIZATION_HOURS = 112;

export type GameAction =
  | { type: "START_NEW_GAME"; payload: NewGameInput }
  | { type: "ACQUIRE_AIRCRAFT"; payload: AcquisitionInput }
  | { type: "OPEN_ROUTE"; payload: RouteDraft }
  | { type: "UPDATE_ROUTE"; payload: RouteUpdate }
  | {
      type: "SET_ROUTE_STATUS";
      payload: { routeId: string; status: RouteStatus };
    }
  | { type: "ADVANCE_DAYS"; payload: { days: 1 | 7 } }
  | { type: "END_TURN" }
  | { type: "ADD_AIRCRAFT"; payload: Aircraft }
  | { type: "ADD_ROUTE"; payload: Route }
  | { type: "BUY_SLOT"; payload: SlotAsset }
  | { type: "SELL_SLOT"; payload: { airport_id: string } }
  | { type: "UPDATE_FUEL_PRICE"; payload: number }
  | { type: "TRIGGER_EVENT"; payload: GameEvent }
  | { type: "LOAD_GAME"; payload: GameState }
  | { type: "REPORT_ERROR"; payload: { title: string; message: string } }
  | { type: "SET_VIEW"; payload: GameView }
  | { type: "SELECT_AIRPORT"; payload: string }
  | { type: "SAVE_FUTURE_ROUTE"; payload: { originIata: string; destinationIata: string; note?: string } }
  | { type: "REMOVE_FUTURE_ROUTE"; payload: string }
  | { type: "RESET_GAME" };

function errorState(state: GameState, title: string, message: string): GameState {
  return {
    ...state,
    notifications: [
      ...state.notifications,
      {
        id: `error-${state.notifications.length + 1}`,
        severity: "error",
        title,
        message,
      },
    ],
    debug: {
      ...state.debug,
      errors: [...state.debug.errors, message],
    },
  };
}

function nextId(prefix: string, currentIds: readonly string[]) {
  let sequence = currentIds.length + 1;
  let candidate = `${prefix}-${sequence}`;

  while (currentIds.includes(candidate)) {
    sequence += 1;
    candidate = `${prefix}-${sequence}`;
  }

  return candidate;
}

function routeWeeklyUtilizationHours(route: Pick<
  Route,
  "originIata" | "destinationIata" | "aircraftId" | "weeklyFrequency"
>, state: GameState) {
  const aircraft = state.fleet.find((item) => item.id === route.aircraftId);
  const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
  const origin = airportByIata.get(route.originIata);
  const destination = airportByIata.get(route.destinationIata);

  if (!model || !origin || !destination) {
    return 0;
  }

  const distanceKm = calculateDistanceKm(
    origin.coordinates,
    destination.coordinates,
  );
  const blockTimeHours = calculateBlockTime(distanceKm, model.cruiseSpeedKmh);
  const turnaroundHours = model.turnaroundMinutes / 60;

  return (
    (blockTimeHours * 2 + turnaroundHours * 2) * route.weeklyFrequency
  );
}

function assignedWeeklyUtilizationHours(
  aircraftId: string,
  routes: readonly Route[],
  state: GameState,
) {
  return routes
    .filter(
      (route) => route.aircraftId === aircraftId && route.status === "active",
    )
    .reduce(
      (total, route) => total + routeWeeklyUtilizationHours(route, state),
      0,
    );
}

function validateRoute(
  draft: RouteDraft,
  state: GameState,
  ignoredRouteId?: string,
) {
  const aircraft = state.fleet.find((item) => item.id === draft.aircraftId);
  const model = aircraft ? aircraftModelById.get(aircraft.modelId) : undefined;
  const origin = airportByIata.get(draft.originIata);
  const destination = airportByIata.get(draft.destinationIata);

  if (!aircraft || !model) {
    return "Select an aircraft already in the player fleet";
  }

  if (!origin || !destination || origin.iata === destination.iata) {
    return "Select two different known airports";
  }

  if (
    !Number.isInteger(draft.weeklyFrequency) ||
    draft.weeklyFrequency < 1 ||
    draft.weeklyFrequency > 7 ||
    draft.operatingDays.length !== draft.weeklyFrequency ||
    new Set(draft.operatingDays).size !== draft.operatingDays.length ||
    draft.operatingDays.some(
      (day) => !Number.isInteger(day) || day < 1 || day > 7,
    )
  ) {
    return "Route schedule must contain one valid operating day per frequency";
  }

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.departureTime)) {
    return "Route departure time is invalid";
  }

  if (
    !Number.isInteger(draft.economySeats) ||
    draft.economySeats < 0 ||
    draft.economySeats > model.economyCapacity ||
    !Number.isInteger(draft.businessSeats) ||
    draft.businessSeats < 0 ||
    draft.businessSeats > model.businessCapacity ||
    draft.economySeats + draft.businessSeats < 1 ||
    !Number.isFinite(draft.economyPrice) ||
    draft.economyPrice <= 0 ||
    !Number.isFinite(draft.businessPrice) ||
    draft.businessPrice <= 0
  ) {
    return "Route seats and prices must be valid for the selected aircraft";
  }

  const otherRoutes = state.routes.filter((route) => route.id !== ignoredRouteId);
  const currentWeeklyUtilizationHours = assignedWeeklyUtilizationHours(
    aircraft.id,
    otherRoutes,
    state,
  );
  const proposedWeeklyUtilizationHours = routeWeeklyUtilizationHours(
    draft,
    state,
  );
  const compatibility = checkRouteCompatibility({
    model,
    origin,
    destination,
    aircraft: {
      available: Number.isFinite(aircraft.reliability) && aircraft.reliability > 0,
      currentWeeklyUtilizationHours,
      proposedWeeklyUtilizationHours,
      maxWeeklyUtilizationHours: MAX_WEEKLY_UTILIZATION_HOURS,
    },
  });

  return compatibility.compatible
    ? undefined
    : `Route is not compatible: ${compatibility.reasons.join(", ")}`;
}

function synchronizeFleetAssignments(
  fleet: GameState["fleet"],
  routes: readonly Route[],
  state: GameState,
) {
  return fleet.map((aircraft) => {
    const assignedRoutes = routes.filter(
      (route) => route.aircraftId === aircraft.id,
    );
    const weeklyUtilizationHours = assignedRoutes
      .filter((route) => route.status === "active")
      .reduce(
      (total, route) => total + routeWeeklyUtilizationHours(route, state),
      0,
    );

    return {
      ...aircraft,
      assignedRouteIds: assignedRoutes.map((route) => route.id),
      utilizationHoursPerDay: weeklyUtilizationHours / 7,
    };
  });
}

function acquireAircraft(
  state: GameState,
  payload: AcquisitionInput,
): GameState {
  const model = aircraftModelById.get(payload.modelId);

  if (!model) {
    return errorState(state, "Aircraft acquisition failed", "Unknown aircraft model");
  }

  if (payload.acquisitionType !== "owned" && payload.acquisitionType !== "leased") {
    return errorState(
      state,
      "Aircraft acquisition failed",
      "Invalid acquisition type",
    );
  }

  const cost =
    payload.acquisitionType === "owned"
      ? model.purchasePrice
      : model.monthlyLease;

  if (!Number.isFinite(cost) || cost <= 0 || state.cash < cost) {
    return errorState(
      state,
      "Aircraft acquisition failed",
      "Insufficient cash for this aircraft",
    );
  }

  const id = nextId(
    `aircraft-${model.id}`,
    state.fleet.map((aircraft) => aircraft.id),
  );

  const prefix = state.airlineName
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");
  const seq = String(state.fleet.length + 1).padStart(3, "0");
  const registration = `${prefix}-${seq}`;

  return {
    ...state,
    cash: state.cash - cost,
    fleet: [
      ...state.fleet,
      {
        id,
        modelId: model.id,
        acquisitionType: payload.acquisitionType,
        ageYears: 0,
        reliability: 1,
        assignedRouteIds: [],
        utilizationHoursPerDay: 0,
        registration,
      },
    ],
  };
}

function openRoute(state: GameState, draft: RouteDraft): GameState {
  const validationError = validateRoute(draft, state);

  if (validationError) {
    return errorState(state, "Route opening failed", validationError);
  }

  const route: Route = {
    ...draft,
    id: nextId(
      `route-${draft.originIata.toLowerCase()}-${draft.destinationIata.toLowerCase()}`,
      state.routes.map((item) => item.id),
    ),
    status: "active",
    performanceHistory: [],
  };
  const routes = [...state.routes, route];

  return {
    ...state,
    routes,
    fleet: synchronizeFleetAssignments(state.fleet, routes, {
      ...state,
      routes,
    }),
  };
}

function updateRoute(state: GameState, update: RouteUpdate): GameState {
  const routeIndex = state.routes.findIndex((route) => route.id === update.routeId);

  if (routeIndex < 0) {
    return errorState(state, "Route update failed", "Unknown route");
  }

  const currentRoute = state.routes[routeIndex];
  const { routeId, ...routeChanges } = update;

  if (routeId !== currentRoute.id) {
    return errorState(state, "Route update failed", "Unknown route");
  }

  const updatedRoute: Route = { ...currentRoute, ...routeChanges };
  const validationError = validateRoute(updatedRoute, state, currentRoute.id);

  if (validationError) {
    return errorState(state, "Route update failed", validationError);
  }

  const routes = state.routes.map((route, index) =>
    index === routeIndex ? updatedRoute : route,
  );

  return {
    ...state,
    routes,
    fleet: synchronizeFleetAssignments(state.fleet, routes, {
      ...state,
      routes,
    }),
  };
}

export function gameReducer(
  state: GameState | null,
  action: GameAction,
): GameState | null {
  if (action.type === "RESET_GAME") {
    return null;
  }

  if (action.type === "START_NEW_GAME") {
    try {
      return createNewGame(action.payload);
    } catch (error) {
      return state
        ? errorState(
            state,
            "New game failed",
            error instanceof Error ? error.message : "Invalid new game",
          )
        : null;
    }
  }

  if (!state) {
    return null;
  }

  switch (action.type) {
    case "ACQUIRE_AIRCRAFT":
      return synchronizeGameState(acquireAircraft(state, action.payload));
    case "OPEN_ROUTE":
      return synchronizeGameState(openRoute(state, action.payload));
    case "UPDATE_ROUTE":
      return synchronizeGameState(updateRoute(state, action.payload));
    case "SET_ROUTE_STATUS": {
      const route = state.routes.find(
        (route) => route.id === action.payload.routeId,
      );

      if (!route) {
        return errorState(state, "Route status failed", "Unknown route");
      }

      if (action.payload.status === "active") {
        const validationError = validateRoute(route, state, route.id);

        if (validationError) {
          return errorState(state, "Route activation failed", validationError);
        }
      }

      const routes = state.routes.map((item) =>
        item.id === route.id ? { ...item, status: action.payload.status } : item,
      );

      return synchronizeGameState({
        ...state,
        routes,
        fleet: synchronizeFleetAssignments(state.fleet, routes, {
          ...state,
          routes,
        }),
      });
    }
    case "ADVANCE_DAYS":
      return synchronizeGameState(advanceDays(state, action.payload.days));
    case "END_TURN":
      return processTurn(state);
    case "ADD_AIRCRAFT":
      return state.fleet.some((aircraft) => aircraft.id === action.payload.id)
        ? errorState(state, "Aircraft addition failed", "Duplicate aircraft ID")
        : synchronizeGameState({
            ...state,
            fleet: [...state.fleet, action.payload],
          });
    case "ADD_ROUTE": {
      if (state.routes.some((route) => route.id === action.payload.id)) {
        return errorState(state, "Route addition failed", "Duplicate route ID");
      }
      const routes = [...state.routes, action.payload];
      return synchronizeGameState({
        ...state,
        routes,
        fleet: synchronizeFleetAssignments(state.fleet, routes, {
          ...state,
          routes,
        }),
      });
    }
    case "BUY_SLOT":
      return synchronizeGameState({
        ...state,
        player: {
          ...state.player,
          slots: [...state.player.slots, action.payload],
        },
      });
    case "SELL_SLOT":
      return synchronizeGameState({
        ...state,
        player: {
          ...state.player,
          slots: state.player.slots.filter(
            (slot) => slot.airport_id !== action.payload.airport_id,
          ),
        },
      });
    case "UPDATE_FUEL_PRICE":
      return Number.isFinite(action.payload) && action.payload > 0
        ? synchronizeGameState({ ...state, market_fuel_price: action.payload })
        : errorState(state, "Fuel update failed", "Invalid fuel price");
    case "TRIGGER_EVENT":
      return synchronizeGameState({
        ...state,
        events_log: [...state.events_log, action.payload],
      });
    case "LOAD_GAME":
      return validateGameState(action.payload)
        ? synchronizeGameState(action.payload)
        : synchronizeGameState(
            errorState(state, "Load failed", "Invalid game state"),
          );
    case "REPORT_ERROR":
      return synchronizeGameState(
        errorState(state, action.payload.title, action.payload.message),
      );
    case "SET_VIEW":
      return synchronizeGameState({ ...state, currentView: action.payload });
    case "SELECT_AIRPORT":
      return synchronizeGameState({ ...state, selectedAirportIata: action.payload });
    case "SAVE_FUTURE_ROUTE": {
      const { originIata, destinationIata, note } = action.payload;
      const existing = (state.futureRoutes ?? []).find(
        r => r.originIata === originIata && r.destinationIata === destinationIata,
      );
      if (existing) return state;
      const id = `fr-${originIata}-${destinationIata}-${Date.now()}`;
      return synchronizeGameState({
        ...state,
        futureRoutes: [...(state.futureRoutes ?? []), { id, originIata, destinationIata, savedAt: state.currentDate, note }],
      });
    }
    case "REMOVE_FUTURE_ROUTE":
      return synchronizeGameState({
        ...state,
        futureRoutes: (state.futureRoutes ?? []).filter(r => r.id !== action.payload),
      });
  }
}
