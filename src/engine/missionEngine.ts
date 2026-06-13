import type {
  Aircraft,
  CoreKPIs,
  GameState,
  Route,
} from "../domain/types";

export type MissionCategory =
  | "TUTORIAL"
  | "CRISIS"
  | "TURNAROUND"
  | "EXPANSION"
  | "SUSTAINABILITY";
export type MissionMedal = "BRONZE" | "SILVER" | "GOLD";
export type MissionAvailability = "LOCKED" | "AVAILABLE" | "COMPLETED";
export type MissionRunStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";
export type MissionStateMetric =
  | "active_routes"
  | "cash_positive"
  | "bankruptcy_free"
  | "survival_turns"
  | "closed_loss_routes"
  | "recapitalized"
  | "no_route_closures";

export interface MissionObjective {
  id: string;
  description: string;
  kpi: keyof CoreKPIs;
  target: number;
  deadline_turn: number;
  required_for: MissionMedal[];
  metric?: MissionStateMetric;
}

export interface MissionScriptedEvent {
  id: string;
  turn: number;
  type: "FUEL_PRICE_MULTIPLIER";
  value: number;
  description: string;
}

export interface Mission {
  id: string;
  category: MissionCategory;
  code: string;
  title: string;
  subtitle: string;
  narrative: string;
  difficulty: 1 | 2 | 3;
  turns_limit: number;
  starting_state: Partial<GameState>;
  objectives: MissionObjective[];
  bronze_condition: string;
  silver_condition: string;
  gold_condition: string;
  prerequisite: string | null;
  tutorial_steps?: string[];
  scripted_events?: MissionScriptedEvent[];
}

export interface MissionProgressEntry {
  completed: boolean;
  best_medal: MissionMedal | null;
}

export type MissionProgress = Record<string, MissionProgressEntry | undefined>;

export interface MissionStatus {
  state: MissionAvailability;
  best_medal: MissionMedal | null;
  prerequisite: string | null;
}

export interface MissionEvaluationContext {
  metrics?: Partial<Record<MissionStateMetric, number>>;
}

export interface MissionObjectiveEvaluation {
  objective: MissionObjective;
  current: number;
  completed: boolean;
  expired: boolean;
}

export interface MissionEvaluation {
  mission: Mission;
  status: MissionRunStatus;
  medal: MissionMedal | null;
  objectives: MissionObjectiveEvaluation[];
  turns_remaining: number;
}

const MEDAL_ORDER: MissionMedal[] = ["BRONZE", "SILVER", "GOLD"];

function starterAircraft(id: string, modelId = "airbus-a220-300"): Aircraft {
  return {
    id,
    modelId,
    acquisitionType: "leased",
    ageYears: 4,
    reliability: 0.94,
    assignedRouteIds: [],
    utilizationHoursPerDay: 0,
    registration: id.toUpperCase(),
  };
}

function starterRoute(
  id: string,
  aircraftId: string,
  destinationIata: string,
  monthlyMargin = 0,
): Route {
  return {
    id,
    originIata: "FCO",
    destinationIata,
    aircraftId,
    weeklyFrequency: 7,
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    departureTime: "08:00",
    economySeats: 120,
    businessSeats: 20,
    economyPrice: 150,
    businessPrice: 420,
    status: "active",
    performanceHistory: [
      {
        date: "2027-01-01",
        passengers: 100,
        loadFactor: 0.72,
        revenue: 100_000,
        costs: 100_000 - monthlyMargin,
        profit: monthlyMargin,
        availableSeatKm: 140_000,
      },
    ],
    margin_monthly: monthlyMargin,
  };
}

function buildFleet(prefix: string, size: number, modelId?: string) {
  return Array.from({ length: size }, (_, index) =>
    starterAircraft(`${prefix}-${index + 1}`, modelId),
  );
}

function buildRoutes(
  prefix: string,
  fleet: Aircraft[],
  destinations: string[],
  lossCount = 0,
) {
  return destinations.map((destination, index) =>
    starterRoute(
      `${prefix}-${index + 1}`,
      fleet[index % fleet.length].id,
      destination,
      index < lossCount ? -2_000_000 : 1_000_000,
    ),
  );
}

const t1Fleet = [starterAircraft("t1-a220-1")];
const t2Fleet = [starterAircraft("t2-a220-1")];
const t2Routes = buildRoutes("t2-route", t2Fleet, ["MXP", "LHR"]);
const c1Fleet = buildFleet("c1-aircraft", 8, "airbus-a320neo");
const c1Routes = buildRoutes(
  "c1-route",
  c1Fleet,
  ["MXP", "LHR", "CDG", "FRA", "MAD", "BCN", "ATH", "VIE"],
);
const r1Fleet = buildFleet("r1-aircraft", 8, "boeing-737-800");
const r1Routes = buildRoutes(
  "r1-route",
  r1Fleet,
  ["MXP", "LHR", "CDG", "FRA", "MAD", "JFK"],
  4,
);
const e1Fleet = buildFleet("e1-aircraft", 4, "airbus-a320neo");
const e1Routes = buildRoutes("e1-route", e1Fleet, ["MXP", "LHR", "CDG", "FRA"]);

export const MISSIONS: readonly Mission[] = [
  {
    id: "first-flight",
    category: "TUTORIAL",
    code: "T1",
    title: "Primo Volo",
    subtitle: "Dalla pista al primo network",
    narrative:
      "Parti con $100M, un A220 e nessuna rotta. Costruisci le fondamenta di una compagnia sostenibile.",
    difficulty: 1,
    turns_limit: 15,
    starting_state: {
      cash: 100_000_000,
      fleet: t1Fleet,
      routes: [],
      hubIata: "FCO",
      game_mode: "MISSION",
      origin: "LCC",
    },
    objectives: [
      {
        id: "t1-routes",
        description: "Apri 2 rotte attive",
        kpi: "fleet_utilization_efficiency",
        metric: "active_routes",
        target: 2,
        deadline_turn: 15,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "t1-load-factor",
        description: "Raggiungi un load factor medio del 70%",
        kpi: "load_factor_avg",
        target: 0.7,
        deadline_turn: 15,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "t1-solvency",
        description: "Evita la bancarotta",
        kpi: "net_debt_to_ebitda",
        metric: "bankruptcy_free",
        target: 1,
        deadline_turn: 15,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "t1-positive-margin",
        description: "Mantieni EBITDA positivo",
        kpi: "ebitda_margin",
        target: 0.001,
        deadline_turn: 15,
        required_for: ["SILVER", "GOLD"],
      },
      {
        id: "t1-gold-load-factor",
        description: "Supera l'80% di load factor e il 10% di margine",
        kpi: "load_factor_avg",
        target: 0.8,
        deadline_turn: 15,
        required_for: ["GOLD"],
      },
      {
        id: "t1-gold-margin",
        description: "Supera il 10% di EBITDA margin",
        kpi: "ebitda_margin",
        target: 0.1,
        deadline_turn: 15,
        required_for: ["GOLD"],
      },
    ],
    bronze_condition: "2 rotte, LF almeno 70%, nessuna bancarotta",
    silver_condition: "Obiettivi Bronzo ed EBITDA positivo",
    gold_condition: "LF almeno 80% ed EBITDA margin almeno 10%",
    prerequisite: null,
    tutorial_steps: [
      "Apri il Planner e scegli una rotta adatta all'A220.",
      "Assegna l'aeromobile e imposta frequenza e orari.",
      "Regola il prezzo finché il load factor supera il 70%.",
      "Apri una seconda rotta senza mandare il cash in negativo.",
    ],
  },
  {
    id: "cost-control",
    category: "TUTORIAL",
    code: "T2",
    title: "Gestione Costi",
    subtitle: "Trasforma il break-even in margine",
    narrative:
      "Una piccola airline è ferma al pareggio. Intervieni su rete, pricing e costi per creare un margine sano.",
    difficulty: 1,
    turns_limit: 20,
    starting_state: {
      cash: 80_000_000,
      fleet: t2Fleet,
      routes: t2Routes,
      hubIata: "FCO",
      game_mode: "MISSION",
      origin: "LCC",
    },
    objectives: [
      {
        id: "t2-margin",
        description: "Porta EBITDA margin almeno al 10% entro il turno 15",
        kpi: "ebitda_margin",
        target: 0.1,
        deadline_turn: 15,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "t2-silver-margin",
        description: "Porta EBITDA margin almeno al 12%",
        kpi: "ebitda_margin",
        target: 0.12,
        deadline_turn: 18,
        required_for: ["SILVER", "GOLD"],
      },
      {
        id: "t2-gold-margin",
        description: "Porta EBITDA margin almeno al 15%",
        kpi: "ebitda_margin",
        target: 0.15,
        deadline_turn: 20,
        required_for: ["GOLD"],
      },
    ],
    bronze_condition: "EBITDA margin almeno 10% entro 15 turni",
    silver_condition: "EBITDA margin almeno 12%",
    gold_condition: "EBITDA margin almeno 15%",
    prerequisite: "T1",
  },
  {
    id: "fuel-crisis",
    category: "CRISIS",
    code: "C1",
    title: "Crisi Carburante",
    subtitle: "Proteggi la cassa dallo shock petrolifero",
    narrative:
      "Il carburante salirà del 60% al turno 3. Sopravvivi alla crisi mantenendo liquidità positiva.",
    difficulty: 2,
    turns_limit: 25,
    starting_state: {
      cash: 180_000_000,
      fleet: c1Fleet,
      routes: c1Routes,
      hubIata: "FCO",
      game_mode: "MISSION",
      market_fuel_price: 1,
    },
    objectives: [
      {
        id: "c1-survive",
        description: "Sopravvivi per 20 turni",
        kpi: "brand_score",
        metric: "survival_turns",
        target: 20,
        deadline_turn: 20,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "c1-cash",
        description: "Mantieni il cash positivo",
        kpi: "net_debt_to_ebitda",
        metric: "cash_positive",
        target: 1,
        deadline_turn: 20,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "c1-routes",
        description: "Non chiudere rotte durante la crisi",
        kpi: "fleet_utilization_efficiency",
        metric: "no_route_closures",
        target: 1,
        deadline_turn: 25,
        required_for: ["GOLD"],
      },
    ],
    bronze_condition: "Cash positivo al turno 20",
    silver_condition: "Cash positivo e nessuna bancarotta",
    gold_condition: "Cash positivo senza chiudere rotte",
    prerequisite: "T2",
    scripted_events: [
      {
        id: "c1-fuel-shock",
        turn: 3,
        type: "FUEL_PRICE_MULTIPLIER",
        value: 1.6,
        description: "Il prezzo del carburante aumenta del 60%.",
      },
    ],
  },
  {
    id: "legacy-turnaround",
    category: "TURNAROUND",
    code: "R1",
    title: "Legacy Turnaround",
    subtitle: "Ristruttura prima che il passato presenti il conto",
    narrative:
      "Erediti una legacy indebitata con quattro rotte in perdita. Chiudile, ricapitalizza e torna profittevole.",
    difficulty: 3,
    turns_limit: 35,
    starting_state: {
      cash: 300_000_000,
      fleet: r1Fleet,
      routes: r1Routes,
      hubIata: "FCO",
      game_mode: "MISSION",
      origin: "LEGACY",
    },
    objectives: [
      {
        id: "r1-close-routes",
        description: "Chiudi le 4 rotte in perdita",
        kpi: "fleet_utilization_efficiency",
        metric: "closed_loss_routes",
        target: 4,
        deadline_turn: 20,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "r1-recapitalize",
        description: "Completa una ricapitalizzazione",
        kpi: "net_debt_to_ebitda",
        metric: "recapitalized",
        target: 1,
        deadline_turn: 25,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "r1-profit",
        description: "Raggiungi EBITDA positivo entro il turno 30",
        kpi: "ebitda_margin",
        target: 0.001,
        deadline_turn: 30,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "r1-gold-margin",
        description: "Raggiungi EBITDA margin almeno al 12%",
        kpi: "ebitda_margin",
        target: 0.12,
        deadline_turn: 35,
        required_for: ["GOLD"],
      },
    ],
    bronze_condition: "Chiudi 4 rotte in perdita, ricapitalizza, EBITDA positivo",
    silver_condition: "Completa il turnaround entro 30 turni",
    gold_condition: "EBITDA margin almeno 12%",
    prerequisite: "C1",
  },
  {
    id: "hub-builder",
    category: "EXPANSION",
    code: "E1",
    title: "Hub Builder",
    subtitle: "Dal 15% alla fortezza",
    narrative:
      "Parti con un hub Level 2 al 15% di market share. Costruisci frequenze e slot fino a controllarlo.",
    difficulty: 3,
    turns_limit: 40,
    starting_state: {
      cash: 250_000_000,
      fleet: e1Fleet,
      routes: e1Routes,
      hubIata: "FCO",
      game_mode: "MISSION",
    },
    objectives: [
      {
        id: "e1-fortress",
        description: "Raggiungi il 60% di hub dominance entro il turno 35",
        kpi: "hub_dominance_pct",
        target: 0.6,
        deadline_turn: 35,
        required_for: ["BRONZE", "SILVER", "GOLD"],
      },
      {
        id: "e1-silver-fortress",
        description: "Raggiungi il 62% di hub dominance",
        kpi: "hub_dominance_pct",
        target: 0.62,
        deadline_turn: 38,
        required_for: ["SILVER", "GOLD"],
      },
      {
        id: "e1-gold-fortress",
        description: "Raggiungi il 65% di hub dominance",
        kpi: "hub_dominance_pct",
        target: 0.65,
        deadline_turn: 40,
        required_for: ["GOLD"],
      },
    ],
    bronze_condition: "Fortress hub al 60% entro 35 turni",
    silver_condition: "Hub dominance almeno 62%",
    gold_condition: "Hub dominance almeno 65%",
    prerequisite: "R1",
  },
] as const;

export const MISSION_CATALOG = MISSIONS;

export function getMissionById(codeOrId: string) {
  const mission = MISSIONS.find(
    (candidate) => candidate.code === codeOrId || candidate.id === codeOrId,
  );
  if (!mission) {
    throw new Error(`Missione sconosciuta: ${codeOrId}`);
  }
  return mission;
}

function progressFor(progress: MissionProgress, mission: Mission) {
  return progress[mission.code] ?? progress[mission.id];
}

export function getMissionStatus(
  missionOrId: Mission | string,
  progress: MissionProgress = {},
): MissionStatus {
  const mission =
    typeof missionOrId === "string" ? getMissionById(missionOrId) : missionOrId;
  const ownProgress = progressFor(progress, mission);
  if (ownProgress?.completed) {
    return {
      state: "COMPLETED",
      best_medal: ownProgress.best_medal,
      prerequisite: null,
    };
  }

  if (mission.prerequisite) {
    const prerequisite = getMissionById(mission.prerequisite);
    if (!progressFor(progress, prerequisite)?.completed) {
      return {
        state: "LOCKED",
        best_medal: null,
        prerequisite: prerequisite.code,
      };
    }
  }

  return { state: "AVAILABLE", best_medal: null, prerequisite: null };
}

function isLosingRoute(route: Route) {
  const latest = route.performanceHistory.at(-1);
  return (route.margin_monthly ?? latest?.profit ?? 0) < 0;
}

function stateMetric(
  metric: MissionStateMetric,
  game: GameState,
  context: MissionEvaluationContext,
) {
  const override = context.metrics?.[metric];
  if (override !== undefined) return override;

  switch (metric) {
    case "active_routes":
      return game.routes.filter((route) => route.status === "active").length;
    case "cash_positive":
      return game.cash > 0 ? 1 : 0;
    case "bankruptcy_free":
      return game.game_status === "BANKRUPT" ? 0 : 1;
    case "survival_turns":
      return game.turn;
    case "closed_loss_routes":
      return game.routes.filter(
        (route) => route.status === "suspended" && isLosingRoute(route),
      ).length;
    case "recapitalized":
      return game.events_log.some((event) =>
        /RECAPITAL|EQUITY|CAPITAL_RAISE/i.test(event.type),
      )
        ? 1
        : 0;
    case "no_route_closures":
      return game.routes.every((route) => route.status === "active") ? 1 : 0;
  }
}

function objectiveValue(
  objective: MissionObjective,
  game: GameState,
  context: MissionEvaluationContext,
) {
  if (objective.metric) return stateMetric(objective.metric, game, context);
  const value = game.player.core_kpis[objective.kpi];
  return typeof value === "number" ? value : 0;
}

function medalEarned(
  medal: MissionMedal,
  objectives: MissionObjectiveEvaluation[],
) {
  const required = objectives.filter(({ objective }) =>
    objective.required_for.includes(medal),
  );
  return required.length > 0 && required.every(({ completed }) => completed);
}

export function evaluateMission(
  missionOrId: Mission | string,
  game: GameState,
  context: MissionEvaluationContext = {},
): MissionEvaluation {
  const mission =
    typeof missionOrId === "string" ? getMissionById(missionOrId) : missionOrId;
  const objectives = mission.objectives.map((objective) => {
    const current = objectiveValue(objective, game, context);
    const expired = game.turn > objective.deadline_turn && current < objective.target;
    return {
      objective,
      current,
      completed: current >= objective.target && game.turn <= objective.deadline_turn,
      expired,
    };
  });
  const medal =
    [...MEDAL_ORDER]
      .reverse()
      .find((candidate) => medalEarned(candidate, objectives)) ?? null;
  const status =
    medal !== null
      ? "COMPLETED"
      : game.turn > mission.turns_limit
        ? "FAILED"
        : "IN_PROGRESS";

  return {
    mission,
    status,
    medal,
    objectives,
    turns_remaining: Math.max(0, mission.turns_limit - game.turn),
  };
}

export function applyMissionTurnEffects(
  missionOrId: Mission | string,
  game: GameState,
  turn = game.turn,
): GameState {
  const mission =
    typeof missionOrId === "string" ? getMissionById(missionOrId) : missionOrId;
  const events = mission.scripted_events?.filter((event) => event.turn === turn);
  if (!events?.length) return game;

  return events.reduce((next, event) => {
    if (next.events_log.some((entry) => entry.id === event.id)) return next;
    if (event.type === "FUEL_PRICE_MULTIPLIER") {
      return {
        ...next,
        market_fuel_price: next.market_fuel_price * event.value,
        events_log: [
          ...next.events_log,
          {
            id: event.id,
            turn,
            type: event.type,
            message: event.description,
            payload: { multiplier: event.value },
          },
        ],
      };
    }
    return next;
  }, game);
}
