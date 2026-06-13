import { npcAirlines } from "../data/npcAirlines";
import type { GameState, NewGameInput } from "../domain/types";
import { synchronizeGameState } from "./stateSync";

export const STARTING_CAPITAL = 150_000_000;
export const STARTING_DATE = "2027-03-18";
export const STARTING_HUBS = ["FCO", "LHR", "JFK", "DXB", "SIN", "GRU"] as const;

export function createNewGame(input: NewGameInput): GameState {
  const airlineName = input.airlineName.trim();

  if (airlineName.length < 2 || airlineName.length > 60) {
    throw new Error("A valid airline name between 2 and 60 characters is required");
  }

  if (!STARTING_HUBS.includes(input.hubIata)) {
    throw new Error("Select a valid starting hub");
  }

  return synchronizeGameState({
    schemaVersion: 1,
    currentDate: STARTING_DATE,
    airlineName,
    hubIata: input.hubIata,
    cash: STARTING_CAPITAL,
    reputation: 0.5,
    fleet: [],
    routes: [],
    npcAirlines: npcAirlines.map((airline) => ({ ...airline })),
    reports: { daily: [], weekly: [] },
    notifications: [],
    currentView: "operations",
    debug: { errors: [], npcEvents: [], lastDemand: [] },
  } as unknown as GameState);
}
