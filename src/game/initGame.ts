import type { GameState, NewGameInput } from "../domain/types";
import { npcAirlines } from "../data/npcAirlines";
import { synchronizeGameState } from "./stateSync";

export function initGame(input: NewGameInput): GameState {
  const today = new Date().toISOString().split("T")[0] ?? "2026-01-01";
  return synchronizeGameState({
    schemaVersion: 1,
    currentDate: today,
    airlineName: input.airlineName.trim(),
    hubIata: input.hubIata,
    cash: 50_000_000,
    reputation: 0.5,
    fleet: [],
    routes: [],
    npcAirlines: [...npcAirlines],
    reports: { daily: [], weekly: [] },
    notifications: [
      {
        id: `welcome-${Date.now()}`,
        severity: "info",
        title: "Benvenuto in Aerogrid",
        message: `${input.airlineName.trim()} è operativa da ${input.hubIata}. Acquista il tuo primo aereo e apri la prima rotta.`,
      },
    ],
    currentView: "operations",
    debug: { errors: [], npcEvents: [], lastDemand: [] },
  } as unknown as GameState);
}
