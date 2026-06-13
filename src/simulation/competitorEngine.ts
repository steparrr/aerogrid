// ============================================================
// TASK 5-B — Competitor AI Engine
// 6 archetipi NPC, sistema di risposta, memoria competitiva
// Fonte: aerogrid_competitor_ai.md
// ============================================================

import type { NpcAirlineExtended, NpcMemory, CompetitorArchetype } from "../domain/types";

// ============================================================
// TIPI
// ============================================================

export type CompetitorTrigger =
  | "PLAYER_OPENS_ROUTE"
  | "PLAYER_CUTS_PRICE"
  | "PLAYER_ADDS_FREQUENCY"
  | "PLAYER_EXITS_ROUTE"
  | "PLAYER_RAISES_PRICE"
  | "TURN_START";

export type PlayerAction = {
  type: "ROUTE_OPENED" | "PRICE_CUT" | "PRICE_RAISE" | "FREQUENCY_CHANGE" | "ROUTE_CLOSED";
  routeKey?: string;      // "FCO-LHR"
  magnitude?: number;     // % variazione prezzo, frequenza aggiunta
  date: string;
};

export type CompetitorAction =
  | { type: "PRICE_CUT";       pct: number;       routes: string[] }
  | { type: "ADD_FREQUENCY";   route: string;     flightsPerWeek: number }
  | { type: "EXIT_ROUTE";      route: string }
  | { type: "ENTER_ROUTE";     route: string }
  | { type: "CAPACITY_DUMP";   route: string }
  | { type: "DO_NOTHING" };

export interface PatternRecord {
  type: string;
  date: string;
  magnitude?: number;
}

export interface PriceMove {
  date: string;
  pct: number;
  trigger: CompetitorTrigger;
}

export interface RouteEvent {
  date: string;
  routeKey: string;
  eventType: "ENTER" | "EXIT";
}

// ============================================================
// PROFILI ARCHETIPO
// ============================================================

interface ArchetypeProfile {
  // Risposta preventiva (annuncio apertura rotta player)
  preemptiveCutPct:    number;   // % taglio preventivo
  preemptiveProb:      number;   // probabilità di farlo

  // Risposta post-entry (dopo 2 turni di operazioni)
  postEntryCutPct:     number;
  postEntryProb:       number;

  // Price war: max turni sotto breakeven
  priceWarMaxTurns:    number;

  // Probabilità di uscire dalla rotta (per anno)
  exitProbYear:        number;

  // Segmenti focus (non compete su certi segmenti)
  ignoresShortHaul:    boolean;
  ignoresLongHaul:     boolean;

  // Tendenza ad aggiungere capacità
  capacityDumpProb:    number;
}

const ARCHETYPE_PROFILES: Record<CompetitorArchetype, ArchetypeProfile> = {
  LEGACY_DOMINANT: {
    preemptiveCutPct: 0.06,  postEntryCutPct: 0.16,
    preemptiveProb: 0.85,    postEntryProb: 0.90,
    priceWarMaxTurns: 8,     exitProbYear: 0.05,
    ignoresShortHaul: false, ignoresLongHaul: false,
    capacityDumpProb: 0.35,
  },
  LEGACY_WEAK: {
    preemptiveCutPct: 0.12,  postEntryCutPct: 0.18,
    preemptiveProb: 0.70,    postEntryProb: 0.65,
    priceWarMaxTurns: 4,     exitProbYear: 0.25,
    ignoresShortHaul: false, ignoresLongHaul: false,
    capacityDumpProb: 0.10,
  },
  LCC: {
    preemptiveCutPct: 0.22,  postEntryCutPct: 0.28,
    preemptiveProb: 0.60,    postEntryProb: 0.75,
    priceWarMaxTurns: 5,     exitProbYear: 0.30,
    ignoresShortHaul: false, ignoresLongHaul: true,
    capacityDumpProb: 0.20,
  },
  ULCC: {
    preemptiveCutPct: 0.32,  postEntryCutPct: 0.38,
    preemptiveProb: 0.55,    postEntryProb: 0.70,
    priceWarMaxTurns: 3,     exitProbYear: 0.50,
    ignoresShortHaul: false, ignoresLongHaul: true,
    capacityDumpProb: 0.15,
  },
  REGIONAL: {
    preemptiveCutPct: 0.04,  postEntryCutPct: 0.06,
    preemptiveProb: 0.20,    postEntryProb: 0.25,
    priceWarMaxTurns: 2,     exitProbYear: 0.15,
    ignoresShortHaul: false, ignoresLongHaul: true,
    capacityDumpProb: 0.05,
  },
  GULF_CARRIER: {
    preemptiveCutPct: 0.05,  postEntryCutPct: 0.10,
    preemptiveProb: 0.30,    postEntryProb: 0.40,
    priceWarMaxTurns: 12,    exitProbYear: 0.03,
    ignoresShortHaul: true,  ignoresLongHaul: false,
    capacityDumpProb: 0.40,
  },
};

// ============================================================
// RISPOSTA COMPETITIVA
// ============================================================

function seededRand(seed: number): number {
  const s = Math.imul(48_271, seed) | 0;
  return ((s >>> 0) / 0xffffffff);
}

function hashStr(s: string): number {
  let h = 2_166_136_261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16_777_619); }
  return h >>> 0;
}

/**
 * Determina l'azione del competitor in risposta al trigger del player.
 * Source: aerogrid_competitor_ai.md sez. 3
 */
export function getCompetitorResponse(
  competitor: NpcAirlineExtended,
  trigger: CompetitorTrigger,
  playerAction: PlayerAction,
): CompetitorAction {
  const archetype = competitor.archetype ?? "LEGACY_WEAK";
  const profile   = ARCHETYPE_PROFILES[archetype];
  const memory    = competitor.memory ?? { lastPlayerActions: [], aggressionLevel: 30, price_response_history: [], route_entry_history: [] };

  // Ignora short-haul / long-haul in base all'archetype
  const routeKey = playerAction.routeKey ?? "";
  if (profile.ignoresShortHaul && isShortHaul(routeKey)) {
    return { type: "DO_NOTHING" };
  }
  if (profile.ignoresLongHaul && !isShortHaul(routeKey)) {
    return { type: "DO_NOTHING" };
  }

  // Seed per decisione deterministica
  const seed = hashStr(`${competitor.id}:${trigger}:${playerAction.date}`);
  const rand = seededRand(seed);

  // Aggressività dinamica: cresce se competitor ha perso share
  const aggrBonus = (memory.aggressionLevel - 50) / 200; // [-0.25, 0.25]

  switch (trigger) {
    case "PLAYER_OPENS_ROUTE": {
      const prob = Math.min(0.95, profile.preemptiveProb + aggrBonus);
      if (rand > prob) return { type: "DO_NOTHING" };

      // LEGACY_DOMINANT preferisce capacity dump su hub
      if (archetype === "LEGACY_DOMINANT" && rand < profile.capacityDumpProb) {
        return { type: "CAPACITY_DUMP", route: routeKey };
      }
      return { type: "PRICE_CUT", pct: profile.preemptiveCutPct, routes: [routeKey] };
    }

    case "PLAYER_CUTS_PRICE": {
      const magnitude = playerAction.magnitude ?? 0.05;
      const prob = Math.min(0.9, 0.4 + magnitude * 3 + aggrBonus);
      if (rand > prob) return { type: "DO_NOTHING" };

      const responseCut = Math.min(profile.postEntryCutPct, magnitude * 0.8);
      return { type: "PRICE_CUT", pct: responseCut, routes: [routeKey] };
    }

    case "PLAYER_ADDS_FREQUENCY": {
      if (archetype === "GULF_CARRIER" || archetype === "REGIONAL") return { type: "DO_NOTHING" };
      const prob = 0.30 + aggrBonus;
      if (rand > prob) return { type: "DO_NOTHING" };
      return { type: "ADD_FREQUENCY", route: routeKey, flightsPerWeek: 1 };
    }

    case "PLAYER_EXITS_ROUTE": {
      // Opportunità: il competitor può entrare
      const prob = 0.25 + aggrBonus;
      if (rand > prob) return { type: "DO_NOTHING" };
      return { type: "ENTER_ROUTE", route: routeKey };
    }

    case "PLAYER_RAISES_PRICE": {
      // Opportunità: catturare pax price-sensitive
      if (archetype === "LCC" || archetype === "ULCC") {
        return { type: "DO_NOTHING" }; // i loro prezzi sono già i più bassi
      }
      return { type: "DO_NOTHING" };
    }

    case "TURN_START": {
      // Check se uscire da rotta non redditizia (price war exhaustion)
      const priceWar = memory.price_response_history?.length ?? 0;
      if (priceWar >= profile.priceWarMaxTurns * 30 && rand < 0.3) {
        return { type: "EXIT_ROUTE", route: routeKey };
      }
      return { type: "DO_NOTHING" };
    }
  }
}

// ============================================================
// MEMORIA NPC
// ============================================================

export interface GameObservation {
  playerAction: PlayerAction;
  date: string;
}

/**
 * Aggiorna la memoria del competitor con l'ultima osservazione del player.
 * Impara i pattern: se player alza sempre i prezzi in estate, anticiperà.
 * Source: aerogrid_competitor_ai.md sez. 4
 */
export function updateCompetitorMemory(
  competitor: NpcAirlineExtended,
  observation: GameObservation,
): NpcAirlineExtended {
  const memory: NpcMemory = competitor.memory ?? {
    lastPlayerActions: [],
    aggressionLevel: 30,
  };

  // Mantieni solo ultime 24 osservazioni (2 anni simulati)
  const updatedActions: PatternRecord[] = [
    ...memory.lastPlayerActions.slice(-23),
    {
      type: observation.playerAction.type,
      date: observation.date,
      magnitude: observation.playerAction.magnitude,
    },
  ];

  // Aggiorna aggressività: sale se player vince price war (prezzi scendono)
  let aggr = memory.aggressionLevel;
  if (observation.playerAction.type === "PRICE_CUT") {
    aggr = Math.min(100, aggr + 3);
  } else if (observation.playerAction.type === "PRICE_RAISE") {
    aggr = Math.max(0, aggr - 2);
  } else if (observation.playerAction.type === "ROUTE_CLOSED") {
    aggr = Math.max(0, aggr - 5); // player cede → meno aggressivo
  }

  return {
    ...competitor,
    memory: {
      ...memory,
      lastPlayerActions: updatedActions,
      aggressionLevel: Math.round(aggr),
    },
  };
}

// ============================================================
// PROCESSO NPC ESTESO (estende processNpcDay di npc.ts)
// ============================================================

/**
 * Processa un NPC per la giornata con archetipo e memoria.
 * Da chiamare in aggiunta a processNpcDay() del modulo base.
 */
export function processNpcWithArchetype(
  competitor: NpcAirlineExtended,
  date: string,
  playerActions: PlayerAction[],
): { competitor: NpcAirlineExtended; actions: CompetitorAction[] } {
  let current = competitor;
  const actions: CompetitorAction[] = [];

  for (const playerAction of playerActions) {
    const trigger = actionToTrigger(playerAction);
    const response = getCompetitorResponse(current, trigger, playerAction);

    if (response.type !== "DO_NOTHING") {
      actions.push(response);
    }

    current = updateCompetitorMemory(current, { playerAction, date });
  }

  // Check TURN_START (eseguito ogni giorno con bassa prob)
  const turnAction = getCompetitorResponse(
    current,
    "TURN_START",
    { type: "ROUTE_CLOSED", date },
  );
  if (turnAction.type !== "DO_NOTHING") actions.push(turnAction);

  return { competitor: current, actions };
}

// ============================================================
// HELPERS
// ============================================================

function isShortHaul(routeKey: string): boolean {
  // Heuristic: rotte intra-continentali sono short-haul
  // Senza calcolo distanza reale, usiamo lista continenti
  const europeanIatas = new Set(["FCO", "LHR", "CDG", "AMS", "FRA", "MAD", "BCN", "VIE", "ZRH", "MXP", "LIS", "CPH", "ARN", "HEL", "WAW", "PRG"]);
  const parts = routeKey.split("-");
  if (parts.length !== 2) return true;
  return europeanIatas.has(parts[0]!) && europeanIatas.has(parts[1]!);
}

function actionToTrigger(action: PlayerAction): CompetitorTrigger {
  switch (action.type) {
    case "ROUTE_OPENED":     return "PLAYER_OPENS_ROUTE";
    case "PRICE_CUT":        return "PLAYER_CUTS_PRICE";
    case "PRICE_RAISE":      return "PLAYER_RAISES_PRICE";
    case "FREQUENCY_CHANGE": return "PLAYER_ADDS_FREQUENCY";
    case "ROUTE_CLOSED":     return "PLAYER_EXITS_ROUTE";
  }
}
