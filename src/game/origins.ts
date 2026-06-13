// ============================================================
// TASK 9-A — Le Tre Origini
// Starting state per i 3 percorsi: LCC, Feeder Regionale, Legacy Restart
// + struttura narrativa 3 atti per la campagna
// Fonte: aerogrid_game_design_core.md sez. 3 origini
// ============================================================

import type { NewGameInput } from "../domain/types";
import type {
  FullGameState,
  GameStateExtended,
  NewGameInputExtended,
  SlotAsset,
} from "../domain/types";
import { createNewGame, STARTING_DATE } from "./initialState";

// ============================================================
// DEFINIZIONE ATTI
// ============================================================

export interface ActDefinition {
  id: 1 | 2 | 3;
  name: string;
  turns: [number, number];      // range giorni simulati
  description: string;
  objectives: string[];
  unlockTrigger: string;
}

export const CAMPAIGN_ACTS: ActDefinition[] = [
  {
    id: 1,
    name: "Sopravvivenza",
    turns: [1, 180],
    description: "I primi 6 mesi: raggiungere la redditività operativa e costruire una base solida.",
    objectives: [
      "Aprire almeno 3 rotte",
      "Raggiungere load factor medio >72%",
      "Cash positivo dopo spese operative",
    ],
    unlockTrigger: "cash > 0 AND routes.active >= 3 AND avgLoadFactor >= 0.72",
  },
  {
    id: 2,
    name: "Espansione",
    turns: [181, 540],
    description: "Anni 2-3: consolidare l'hub, affrontare i competitor, acquisire slot preziosi.",
    objectives: [
      "Raggiungere Livello 2 (8+ rotte)",
      "Dominanza hub >25%",
      "Prima rotta internazionale",
    ],
    unlockTrigger: "playerLevel >= 2 AND hubDominance >= 0.25",
  },
  {
    id: 3,
    name: "Dominio",
    turns: [541, 1095],
    description: "Anni 3-5: percorso verso la vittoria — scala, redditività o green leadership.",
    objectives: [
      "Completare il percorso di vittoria scelto",
      "Livello 4+",
      "EBITDA margin >15%",
    ],
    unlockTrigger: "victory === true OR playerLevel >= 4",
  },
];

// ============================================================
// HELPER: crea slot aeroportuale
// ============================================================

function makeSlot(
  airportIata: string,
  purchasePrice: number,
  utilization = 0.95,
): SlotAsset {
  return {
    airportIata,
    purchasePrice,
    marketValue: Math.round(purchasePrice * 1.2),
    utilizationThisSeason: utilization,
    status: "ACTIVE",
  };
}

// ============================================================
// ORIGIN 1: LCC STARTUP (★☆☆)
// Cash: $150M · Fleet: 2× A220-300 dry lease · Routes: 0
// Difficoltà: facile — partiamo da zero
// ============================================================

export function createLccStart(input: NewGameInput): FullGameState {
  const base = createNewGame(input);

  const ext: GameStateExtended = {
    gameMode:    "CAMPAIGN",
    origin:      "LCC",
    victoryPath: "PROFIT",
    playerLevel: 1,
    slots:       [makeSlot(input.hubIata, 800_000, 0.20)],
    fuelHedges:  [],
    aogHistory:  [],
    maintenanceSchedule: [],
    marketFuelPricePerKg: 0.90,
    consecutiveNegativeCashDays: 0,
    distribution: {
      channels:   ["DIRECT"],
      channelMix: { DIRECT: 100 },
    },
    loyalty: {
      tier: 0,
      milesOutstanding: 0,
      breakageRate: 0.25,
    },
  };

  // 2× A220-300 dry lease (catalogo id "airbus-a220-300")
  const fleet = [
    {
      id: "ac-lcc-01",
      modelId: "airbus-a220-300",
      acquisitionType: "leased" as const,
      ageYears: 2,
      reliability: 0.97,
      assignedRouteIds: [],
      utilizationHoursPerDay: 0,
      flightHoursSinceACheck: 0,
      turnsSinceCCheck: 0,
      condition: 95,
      status: "available" as const,
    },
    {
      id: "ac-lcc-02",
      modelId: "airbus-a220-300",
      acquisitionType: "leased" as const,
      ageYears: 3,
      reliability: 0.96,
      assignedRouteIds: [],
      utilizationHoursPerDay: 0,
      flightHoursSinceACheck: 120,
      turnsSinceCCheck: 50,
      condition: 92,
      status: "available" as const,
    },
  ];

  return {
    ...base,
    ...ext,
    fleet,
    cash: 150_000_000,
    reputation: 0.40,
  } as FullGameState;
}

// ============================================================
// ORIGIN 2: FEEDER REGIONALE (★★☆)
// Cash: $80M · Fleet: 4× E175 dry lease · Routes: 3 pre-configurate
// Difficoltà: media — cash limitato, rotte già aperte
// ============================================================

export function createRegionalStart(input: NewGameInput): FullGameState {
  const base = createNewGame(input);

  // 3 rotte feeder pre-esistenti (hub → città vicine)
  // Usiamo IATA simbolici; il reducer le aprirà correttamente
  const feederRoutes = buildFeederRoutes(input.hubIata);

  const fleet = [
    { id: "ac-reg-01", modelId: "embraer-e175",  acquisitionType: "leased" as const, ageYears: 4,  reliability: 0.96, assignedRouteIds: [feederRoutes[0]?.id ?? ""], utilizationHoursPerDay: 6, flightHoursSinceACheck: 200, turnsSinceCCheck: 120, condition: 88, status: "in_service" as const },
    { id: "ac-reg-02", modelId: "embraer-e175",  acquisitionType: "leased" as const, ageYears: 5,  reliability: 0.95, assignedRouteIds: [feederRoutes[1]?.id ?? ""], utilizationHoursPerDay: 6, flightHoursSinceACheck: 280, turnsSinceCCheck: 150, condition: 85, status: "in_service" as const },
    { id: "ac-reg-03", modelId: "embraer-e175",  acquisitionType: "leased" as const, ageYears: 3,  reliability: 0.97, assignedRouteIds: [feederRoutes[2]?.id ?? ""], utilizationHoursPerDay: 5, flightHoursSinceACheck: 100, turnsSinceCCheck: 80,  condition: 92, status: "in_service" as const },
    { id: "ac-reg-04", modelId: "embraer-e175",  acquisitionType: "leased" as const, ageYears: 6,  reliability: 0.94, assignedRouteIds: [],                         utilizationHoursPerDay: 0, flightHoursSinceACheck: 350, turnsSinceCCheck: 200, condition: 80, status: "available" as const },
  ];

  const ext: GameStateExtended = {
    gameMode:    "CAMPAIGN",
    origin:      "REGIONAL",
    victoryPath: "NETWORK",
    playerLevel: 2,
    slots:       [makeSlot(input.hubIata, 1_200_000, 0.75)],
    fuelHedges:  [],
    aogHistory:  [],
    maintenanceSchedule: [],
    marketFuelPricePerKg: 0.90,
    consecutiveNegativeCashDays: 0,
    distribution: {
      channels:   ["DIRECT", "GDS"],
      channelMix: { DIRECT: 60, GDS: 40 },
    },
    loyalty: {
      tier: 1,
      milesOutstanding: 2_400_000,
      breakageRate: 0.25,
    },
  };

  return {
    ...base,
    ...ext,
    fleet,
    routes: feederRoutes,
    cash: 80_000_000,
    reputation: 0.55,
  } as FullGameState;
}

// ============================================================
// ORIGIN 3: LEGACY RESTART (★★★)
// Cash: $300M · Debt: $200M · Fleet: 8 aerei misti, età media 12 anni
// Routes: 6 (4 in perdita) · Slot storici L3
// Difficoltà: alta — devi risanare
// ============================================================

export function createLegacyStart(input: NewGameInput): FullGameState {
  const base = createNewGame(input);

  const routes = buildLegacyRoutes(input.hubIata);
  const fleet = buildLegacyFleet(routes);

  const ext: GameStateExtended = {
    gameMode:    "CAMPAIGN",
    origin:      "LEGACY",
    victoryPath: "DOMINATOR",
    playerLevel: 3,
    slots: [
      makeSlot(input.hubIata, 8_000_000, 0.90),
      makeSlot(secondaryHub(input.hubIata), 4_500_000, 0.72),
    ],
    fuelHedges: [
      {
        type:           "SWAP",
        coveragePct:    50,
        durationMonths: 6,
        strikePrice:    0.88,
        premiumPaid:    0,
        monthlySaving:  0,
        status:         "ACTIVE",
        startDate:      STARTING_DATE,
      },
    ],
    aogHistory:  [],
    maintenanceSchedule: [],
    marketFuelPricePerKg: 0.90,
    consecutiveNegativeCashDays: 0,
    distribution: {
      channels:   ["DIRECT", "GDS", "OTA"],
      channelMix: { DIRECT: 30, GDS: 50, OTA: 20 },
    },
    loyalty: {
      tier: 3,
      milesOutstanding: 48_000_000,
      breakageRate: 0.25,
    },
    staff: {
      pilotsNarrow: 24,
      pilotsWide: 16,
      pilotsRequiredNarrow: 20,
      pilotsRequiredWide: 16,
      unionMorale: 52,
      unionContractExpiresDate: "2027-08-15",
      strikeRisk: 0.18,
    },
  };

  return {
    ...base,
    ...ext,
    fleet,
    routes,
    cash: 300_000_000,
    reputation: 0.65,
  } as FullGameState;
}

// ============================================================
// FACTORY PRINCIPALE
// ============================================================

/**
 * Crea il GameState iniziale in base all'origine scelta.
 */
export function createGameByOrigin(input: NewGameInputExtended): FullGameState {
  switch (input.origin) {
    case "LCC":      return createLccStart(input);
    case "REGIONAL": return createRegionalStart(input);
    case "LEGACY":   return createLegacyStart(input);
    default:         return createLccStart(input);
  }
}

// ============================================================
// HELPERS INTERNI
// ============================================================

function buildFeederRoutes(hubIata: string) {
  // Rotte feeder simboliche: hub → 3 città vicine
  const feeders: Record<string, [string, string, string]> = {
    FCO: ["BLQ", "NAP", "PMO"],
    LHR: ["MAN", "EDI", "BHX"],
    JFK: ["BOS", "DCA", "ORD"],
    DXB: ["MCT", "BAH", "KWI"],
    SIN: ["KUL", "BKK", "CGK"],
    GRU: ["CGH", "BSB", "POA"],
  };

  const dests = feeders[hubIata] ?? ["AAA", "BBB", "CCC"];

  return dests.map((destIata, i) => ({
    id:             `route-feeder-${i + 1}`,
    originIata:     hubIata,
    destinationIata: destIata,
    aircraftId:     `ac-reg-0${i + 1}`,
    weeklyFrequency: 7,
    operatingDays:  [1, 2, 3, 4, 5, 6, 7],
    departureTime:  ["07:30", "10:15", "15:45"][i] ?? "08:00",
    economySeats:   76,
    businessSeats:  8,
    economyPrice:   120 + i * 20,
    businessPrice:  380 + i * 40,
    status:         "active" as const,
    performanceHistory: [],
  }));
}

function buildLegacyRoutes(hubIata: string) {
  const longHaulDests: Record<string, string[]> = {
    FCO: ["JFK", "DXB", "GRU", "BKK", "NRT", "LAX"],
    LHR: ["JFK", "DXB", "SIN", "HKG", "SYD", "GRU"],
    JFK: ["LHR", "CDG", "FCO", "LAX", "NRT", "GRU"],
    DXB: ["LHR", "JFK", "SIN", "BOM", "DEL", "NRT"],
    SIN: ["LHR", "JFK", "DXB", "SYD", "NRT", "BOM"],
    GRU: ["LHR", "JFK", "FCO", "CDG", "EZE", "SCL"],
  };

  const dests = longHaulDests[hubIata] ?? ["LHR", "JFK", "DXB", "SIN", "GRU", "NRT"];

  return dests.map((destIata, i) => ({
    id:             `route-legacy-${i + 1}`,
    originIata:     hubIata,
    destinationIata: destIata,
    aircraftId:     `ac-leg-0${i + 1}`,
    weeklyFrequency: i < 4 ? 7 : 3,
    operatingDays:  i < 4 ? [1,2,3,4,5,6,7] : [1,3,5],
    departureTime:  ["08:00", "10:30", "14:00", "17:30", "22:00", "09:15"][i] ?? "12:00",
    economySeats:   200,
    businessSeats:  32,
    economyPrice:   [380, 420, 510, 490, 560, 640][i] ?? 400,
    businessPrice:  [1900, 2100, 2600, 2500, 2900, 3200][i] ?? 2000,
    status:         "active" as const,
    performanceHistory: [],
  }));
}

function buildLegacyFleet(routes: ReturnType<typeof buildLegacyRoutes>) {
  const models = [
    "boeing-737-800", "boeing-737-800", "airbus-a320",   "airbus-a320",
    "boeing-777-300er", "boeing-777-300er", "boeing-787-9", "boeing-787-9",
  ];
  const ages = [8, 12, 10, 15, 14, 11, 6, 7];

  return models.map((modelId, i) => ({
    id:                       `ac-leg-0${i + 1}`,
    modelId,
    acquisitionType:          (i < 4 ? "leased" : "owned") as "leased" | "owned",
    ageYears:                 ages[i] ?? 10,
    reliability:              0.90 - (ages[i] ?? 10) * 0.005,
    assignedRouteIds:         routes[i] ? [routes[i]!.id] : [],
    utilizationHoursPerDay:   routes[i] ? 8 : 0,
    flightHoursSinceACheck:   100 + i * 55,
    turnsSinceCCheck:         200 + i * 80,
    turnsSinceEngineOverhaul: 800 + i * 200,
    totalCycles:              (ages[i] ?? 10) * 365,
    condition:                85 - i * 3,
    status:                   (routes[i] ? "in_service" : "available") as "in_service" | "available",
  }));
}

function secondaryHub(hubIata: string): string {
  const secondaries: Record<string, string> = {
    FCO: "MXP", LHR: "LGW", JFK: "EWR", DXB: "AUH", SIN: "KUL", GRU: "GIG",
  };
  return secondaries[hubIata] ?? "XXX";
}
