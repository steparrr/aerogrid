import { npcAirlines } from "../data/npcAirlines";
import type { Aircraft, GameState, Route } from "../domain/types";
import { synchronizeGameState } from "../game/stateSync";

export function leased787Fixture(): Aircraft {
  return {
    id: "aircraft-test-787",
    modelId: "boeing-787-9",
    acquisitionType: "leased",
    ageYears: 2,
    reliability: 0.98,
    assignedRouteIds: [],
    utilizationHoursPerDay: 0,
  };
}

export function playableStateFixture(): GameState {
  const aircraft = leased787Fixture();
  const route: Route = {
    id: "route-fco-jfk",
    originIata: "FCO",
    destinationIata: "JFK",
    aircraftId: aircraft.id,
    weeklyFrequency: 7,
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    departureTime: "10:00",
    economySeats: 250,
    businessSeats: 30,
    economyPrice: 620,
    businessPrice: 2400,
    status: "active",
    performanceHistory: [],
  };

  return synchronizeGameState({
    schemaVersion: 1,
    currentDate: "2027-03-18",
    airlineName: "Aeria Test",
    hubIata: "FCO",
    cash: 50_000_000,
    reputation: 0.5,
    fleet: [{ ...aircraft, assignedRouteIds: [route.id] }],
    routes: [route],
    npcAirlines,
    reports: { daily: [], weekly: [] },
    notifications: [],
    currentView: "operations",
    debug: { errors: [], npcEvents: [], lastDemand: [] },
  } as unknown as GameState);
}

export function validSaveFileFixture(
  state = playableStateFixture(),
): File {
  return new File(
    [
      JSON.stringify({
        schemaVersion: 1,
        savedAt: "2027-03-18T12:00:00.000Z",
        game: state,
      }),
    ],
    "aeria-save.json",
    { type: "application/json" },
  );
}
