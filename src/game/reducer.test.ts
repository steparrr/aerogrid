import { describe, expect, it } from "vitest";

import { aircraftModelById } from "../data/indexes";
import type { GameState, RouteDraft } from "../domain/types";
import { leased787Fixture, playableStateFixture } from "../test/fixtures";
import { createNewGame } from "./initialState";
import { gameReducer } from "./reducer";
import {
  selectFinanceTotals,
  selectFleetUtilization,
  selectLatestReport,
  selectMobileSummary,
  selectRouteRanking,
} from "./selectors";

function fcoJfkDraft(
  aircraftId = leased787Fixture().id,
): RouteDraft {
  return {
    originIata: "FCO",
    destinationIata: "JFK",
    aircraftId,
    weeklyFrequency: 3,
    operatingDays: [1, 3, 5],
    departureTime: "10:00",
    economySeats: 250,
    businessSeats: 30,
    economyPrice: 620,
    businessPrice: 2_400,
  };
}

describe("game state and player actions", () => {
  it("creates a new game with capital, eight NPCs, and no player assets", () => {
    const state = createNewGame({ airlineName: " Aeria ", hubIata: "FCO" });

    expect(state.airlineName).toBe("Aeria");
    expect(state.cash).toBeGreaterThan(0);
    expect(state.fleet).toEqual([]);
    expect(state.routes).toEqual([]);
    expect(state.npcAirlines).toHaveLength(8);
  });

  it("creates one neutral AeroGrid root state synchronized with the MVP state", () => {
    const state = createNewGame({ airlineName: "Aeria", hubIata: "FCO" });

    expect(state).toMatchObject({
      turn: 0,
      game_date: { year: 2027, month: 3 },
      game_mode: "SANDBOX",
      origin: null,
      victory_path: null,
      market_fuel_price: 0.8,
      events_log: [],
      pending_decisions: [],
    });
    expect(state.player).toMatchObject({
      name: state.airlineName,
      hub: state.hubIata,
      cash: state.cash,
      fleet: state.fleet,
      routes: state.routes,
    });
    expect(state.competitors).toHaveLength(state.npcAirlines.length);
    expect(state.airports.FCO?.iata).toBe("FCO");
  });

  it("rejects an invalid airline name or starting hub", () => {
    expect(() =>
      createNewGame({ airlineName: " ", hubIata: "FCO" }),
    ).toThrow("airline name");
    expect(() =>
      createNewGame({
        airlineName: "Aeria",
        hubIata: "FRA" as GameState["hubIata"] & "FCO",
      }),
    ).toThrow("starting hub");
  });

  it("starts a new game from an empty provider state", () => {
    const next = gameReducer(null, {
      type: "START_NEW_GAME",
      payload: { airlineName: "Aeria", hubIata: "FCO" },
    });

    expect(next).toMatchObject({ airlineName: "Aeria", hubIata: "FCO" });
  });

  it("leases an aircraft and reduces cash only by its initial lease charge", () => {
    const state = createNewGame({ airlineName: "Aeria", hubIata: "FCO" });
    const model = aircraftModelById.get("boeing-787-9")!;
    const next = gameReducer(state, {
      type: "ACQUIRE_AIRCRAFT",
      payload: { modelId: model.id, acquisitionType: "leased" },
    })!;

    expect(next.fleet).toHaveLength(1);
    expect(next.fleet[0]).toMatchObject({
      modelId: model.id,
      acquisitionType: "leased",
      assignedRouteIds: [],
    });
    expect(next.cash).toBe(state.cash - model.monthlyLease);
  });

  it("buys an aircraft at purchase price and creates deterministic unique IDs", () => {
    const state = createNewGame({ airlineName: "Aeria", hubIata: "FCO" });
    const model = aircraftModelById.get("atr-72-600")!;
    const first = gameReducer(state, {
      type: "ACQUIRE_AIRCRAFT",
      payload: { modelId: model.id, acquisitionType: "owned" },
    })!;
    const second = gameReducer(first, {
      type: "ACQUIRE_AIRCRAFT",
      payload: { modelId: model.id, acquisitionType: "owned" },
    })!;

    expect(second.cash).toBe(state.cash - model.purchasePrice * 2);
    expect(new Set(second.fleet.map((aircraft) => aircraft.id)).size).toBe(2);
  });

  it("blocks acquisition when cash is insufficient", () => {
    const state = {
      ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }),
      cash: 0,
    };
    const next = gameReducer(state, {
      type: "ACQUIRE_AIRCRAFT",
      payload: { modelId: "airbus-a380-800", acquisitionType: "owned" },
    })!;

    expect(next.fleet).toEqual([]);
    expect(next.cash).toBe(0);
    expect(next.notifications.at(-1)?.severity).toBe("error");
  });

  it("opens only a compatible route chosen by the player and assigns its aircraft", () => {
    const aircraft = leased787Fixture();
    const state = {
      ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }),
      fleet: [aircraft],
    };
    const next = gameReducer(state, {
      type: "OPEN_ROUTE",
      payload: fcoJfkDraft(aircraft.id),
    })!;

    expect(next.routes).toHaveLength(1);
    expect(next.routes[0]).toMatchObject({
      originIata: "FCO",
      destinationIata: "JFK",
      aircraftId: aircraft.id,
      status: "active",
    });
    expect(next.fleet[0].assignedRouteIds).toEqual([next.routes[0].id]);
    expect(next.fleet[0].utilizationHoursPerDay).toBeGreaterThan(0);
  });

  it("rejects an impossible route without changing protected state", () => {
    const aircraft = {
      ...leased787Fixture(),
      modelId: "atr-72-600",
    };
    const state = {
      ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }),
      fleet: [aircraft],
    };
    const next = gameReducer(state, {
      type: "OPEN_ROUTE",
      payload: fcoJfkDraft(aircraft.id),
    })!;

    expect(next.routes).toEqual(state.routes);
    expect(next.fleet).toEqual(state.fleet);
    expect(next.notifications.at(-1)?.severity).toBe("error");
  });

  it("allows price edits, reassignment, and route suspension", () => {
    const state = playableStateFixture();
    const secondAircraft = {
      ...leased787Fixture(),
      id: "aircraft-second-787",
    };
    const withSecondAircraft = {
      ...state,
      fleet: [...state.fleet, secondAircraft],
    };
    const reassigned = gameReducer(withSecondAircraft, {
      type: "UPDATE_ROUTE",
      payload: {
        routeId: "route-fco-jfk",
        aircraftId: secondAircraft.id,
        economyPrice: 700,
        weeklyFrequency: 3,
        operatingDays: [1, 3, 5],
      },
    })!;
    const suspended = gameReducer(reassigned, {
      type: "SET_ROUTE_STATUS",
      payload: { routeId: "route-fco-jfk", status: "suspended" },
    })!;

    expect(suspended.routes[0]).toMatchObject({
      economyPrice: 700,
      status: "suspended",
      aircraftId: secondAircraft.id,
    });
    expect(suspended.fleet[0].assignedRouteIds).toEqual([]);
    expect(suspended.fleet[1].assignedRouteIds).toEqual(["route-fco-jfk"]);
    expect(suspended.routes[0]).not.toHaveProperty("routeId");
  });

  it("releases aircraft utilization while a route is suspended", () => {
    const aircraft = leased787Fixture();
    const initial = {
      ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }),
      fleet: [aircraft],
    };
    const opened = gameReducer(initial, {
      type: "OPEN_ROUTE",
      payload: fcoJfkDraft(aircraft.id),
    })!;
    const suspended = gameReducer(opened, {
      type: "SET_ROUTE_STATUS",
      payload: { routeId: opened.routes[0].id, status: "suspended" },
    })!;

    expect(opened.fleet[0].utilizationHoursPerDay).toBeGreaterThan(0);
    expect(suspended.fleet[0].assignedRouteIds).toEqual([opened.routes[0].id]);
    expect(suspended.fleet[0].utilizationHoursPerDay).toBe(0);
  });

  it("advances time and changes views through explicit actions", () => {
    const state = playableStateFixture();
    const advanced = gameReducer(state, {
      type: "ADVANCE_DAYS",
      payload: { days: 1 },
    })!;
    const viewed = gameReducer(advanced, {
      type: "SET_VIEW",
      payload: "finance",
    })!;

    expect(advanced.currentDate).toBe("2027-03-19");
    expect(viewed.currentView).toBe("finance");
  });

  it("supports AeroGrid actions while keeping the player snapshot synchronized", () => {
    const state = playableStateFixture();
    const slot = {
      airport_id: "FCO",
      owner_id: state.player.id,
      purchase_price: 1_000_000,
      market_value: 1_000_000,
      utilization_this_season: 1,
      status: "ACTIVE" as const,
    };
    const withSlot = gameReducer(state, { type: "BUY_SLOT", payload: slot })!;
    const withFuel = gameReducer(withSlot, {
      type: "UPDATE_FUEL_PRICE",
      payload: 0.9,
    })!;
    const withEvent = gameReducer(withFuel, {
      type: "TRIGGER_EVENT",
      payload: {
        id: "event-test",
        turn: withFuel.turn,
        type: "TEST",
        message: "Test event",
      },
    })!;

    expect(withSlot.player.slots).toContainEqual(slot);
    expect(withFuel.market_fuel_price).toBe(0.9);
    expect(withEvent.events_log.at(-1)?.id).toBe("event-test");
    expect(withEvent.player.cash).toBe(withEvent.cash);
    expect(withEvent.player.routes).toEqual(withEvent.routes);
  });

  it("ends one monthly turn through the reducer", () => {
    const state = playableStateFixture();
    const next = gameReducer(state, { type: "END_TURN" })!;

    expect(next.turn).toBe(state.turn + 1);
    expect(next.game_date).toEqual({ year: 2027, month: 4 });
    expect(next.player.game_date).toEqual(next.game_date);
  });

  it("rejects a directly loaded invalid game without replacing current state", () => {
    const state = playableStateFixture();
    const next = gameReducer(state, {
      type: "LOAD_GAME",
      payload: { ...state, cash: Number.NaN },
    })!;

    expect(next.cash).toBe(state.cash);
    expect(next.notifications.at(-1)).toMatchObject({
      severity: "error",
      title: "Load failed",
    });
  });
});

describe("game selectors", () => {
  it("derives latest report, rankings, utilization, finance totals, and mobile summary", () => {
    const base = playableStateFixture();
    const routeResult = {
      date: base.currentDate,
      passengers: 240,
      loadFactor: 0.8,
      revenue: 120_000,
      costs: 90_000,
      profit: 30_000,
      availableSeatKm: 1_000_000,
    };
    const state: GameState = {
      ...base,
      routes: [
        {
          ...base.routes[0],
          performanceHistory: [routeResult],
        },
      ],
      reports: {
        ...base.reports,
        daily: [
          {
            date: base.currentDate,
            passengers: 240,
            revenue: 120_000,
            costs: 90_000,
            profit: 30_000,
            cask: 0.09,
            rask: 0.12,
            operatingMargin: 0.25,
            routeResults: [routeResult],
          },
        ],
      },
      notifications: [
        {
          id: "warning",
          severity: "warning",
          title: "Warning",
          message: "Check route",
        },
      ],
    };

    expect(selectLatestReport(state)?.profit).toBe(30_000);
    expect(selectRouteRanking(state)[0].routeId).toBe("route-fco-jfk");
    expect(selectFleetUtilization(state)[0].aircraftId).toBe(
      "aircraft-test-787",
    );
    expect(selectFinanceTotals(state)).toMatchObject({
      cash: state.cash,
      revenue: 120_000,
      costs: 90_000,
      profit: 30_000,
    });
    expect(selectMobileSummary(state)).toMatchObject({
      currentDate: state.currentDate,
      cash: state.cash,
      activeRoutes: 1,
      latestProfit: 30_000,
      unreadNotifications: 1,
    });
  });
});
