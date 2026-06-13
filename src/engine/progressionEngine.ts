import type { GameState, PlayerLevel, Route } from "../domain/types";
import { calculateDistanceKm } from "../simulation/geography";

export interface Feature {
  id: string;
  label: string;
  description: string;
  unlockedAt: PlayerLevel;
}

export interface LevelDefinition {
  level: PlayerLevel;
  name: "STARTUP" | "REGIONAL" | "NETWORK" | "MAJOR" | "GLOBAL";
  description: string;
  unlockCondition: string;
  color: string;
}

export interface LevelUpResult {
  previousLevel: PlayerLevel;
  newLevel: PlayerLevel;
  title: LevelDefinition["name"];
  description: string;
  unlockedFeatures: Feature[];
  nextObjective: string | null;
}

export interface ProgressMetric {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  complete: boolean;
}

export interface NextLevelProgress {
  targetLevel: PlayerLevel;
  targetName: LevelDefinition["name"];
  condition: string;
  metrics: ProgressMetric[];
  overallPercent: number;
  recommendation: string;
}

export type MilestoneStatus = "ACHIEVED" | "IN_PROGRESS" | "LOCKED";

export interface MilestoneProgress {
  id: string;
  title: string;
  description: string;
  narrative: string;
  reward: string;
  requiredLevel: PlayerLevel;
  status: MilestoneStatus;
  current: number;
  target: number;
  unit: string;
}

export const LEVELS: readonly LevelDefinition[] = [
  {
    level: 1,
    name: "STARTUP",
    description: "Una compagnia giovane costruisce le prime rotte e disciplina i costi.",
    unlockCondition: "Livello iniziale",
    color: "#64748B",
  },
  {
    level: 2,
    name: "REGIONAL",
    description: "La startup diventa un carrier regionale riconoscibile.",
    unlockCondition: "8+ rotte attive OPPURE $50M EBITDA mensile",
    color: "#00C8FF",
  },
  {
    level: 3,
    name: "NETWORK",
    description: "Il network crea connessioni, traffico corporate e potere di hub.",
    unlockCondition: "Hub con >30% market share OPPURE primo wide-body long-haul",
    color: "#93C5FD",
  },
  {
    level: 4,
    name: "MAJOR",
    description: "Una major può stringere alleanze e consolidare il mercato.",
    unlockCondition: "Hub fortress >50% OPPURE $500M EBITDA annualizzato",
    color: "#A78BFA",
  },
  {
    level: 5,
    name: "GLOBAL",
    description: "Il network opera su scala globale e accede ai mercati dei capitali.",
    unlockCondition: "60+ rotte attive su almeno 3 continenti",
    color: "#C9A84C",
  },
] as const;

const FEATURES: readonly Feature[] = [
  feature("SHORT_HAUL_ROUTES", "Rotte domestic e short-haul", 1, "Apertura delle rotte operative iniziali."),
  feature("NARROW_BODY_DRY_LEASE", "Narrow-body in dry lease", 1, "Leasing operativo della flotta iniziale."),
  feature("ACMI", "ACMI per picchi di domanda", 1, "Capacità temporanea per assorbire i picchi."),
  feature("DIRECT_DISTRIBUTION", "Distribuzione diretta", 1, "Vendita diretta ai passeggeri."),
  feature("BASE_YIELD_MANAGEMENT", "Yield management base", 1, "Controllo tariffario essenziale."),
  feature("MARKET_INTEL_T1", "Market Intel Tier 1", 1, "Intelligence aggregata gratuita."),

  feature("WIDE_BODY_DRY_LEASE", "Wide-body in dry lease", 2, "Wide-body per rotte medium-haul."),
  feature("GDS_SUBSCRIPTION", "GDS subscription", 2, "Accesso ai sistemi di distribuzione globale."),
  feature("LOYALTY_TIER_1", "Loyalty Tier 1", 2, "Programma AeroGrid Points."),
  feature("METASEARCH", "Metasearch integration", 2, "Distribuzione sui comparatori."),
  feature("MARKET_INTEL_T2", "Market Intel Tier 2", 2, "Analisi dei segmenti di domanda."),
  feature("SECONDARY_SLOT_MARKET_L2", "Mercato secondario slot L2", 2, "Compravendita di slot di livello 2."),

  feature("WIDE_BODY_LONG_HAUL", "Wide-body long-haul", 3, "A350, B777 e altri wide-body long-haul."),
  feature("LOYALTY_TIER_2", "Loyalty Tier 2", 3, "Carta co-branded con banca."),
  feature("CORPORATE_SALES", "Corporate sales team", 3, "Contratti corporate formali."),
  feature("HUB_WAVE_STRUCTURE", "Hub wave structure", 3, "Attiva il segmento transit."),
  feature("MARKET_INTEL_T3", "Market Intel Tier 3", 3, "Competitive intelligence avanzata."),
  feature("CONGESTED_SLOT_MARKET", "Slot market congestionati", 3, "Acquisto e vendita negli aeroporti congestionati."),
  feature("SMALL_CARRIER_ACQUISITION", "M&A piccoli carrier", 3, "Acquisizione di carrier regionali."),
  feature("BASIC_MRO", "MRO base in-house", 3, "Manutenzione interna per flotte omogenee."),
  feature("FUEL_HEDGING", "Fuel hedging", 3, "Strumenti base di copertura carburante."),

  feature("ULTRA_LONG_HAUL", "Ultra long-haul", 4, "Operazioni con aeromobili ULR."),
  feature("LOYALTY_TIER_3", "Loyalty Tier 3", 4, "Ecosistema banche, retail e hotel."),
  feature("ALLIANCE_MEMBERSHIP", "Alliance membership", 4, "Ingresso in una grande alleanza."),
  feature("JOINT_VENTURE", "Joint Venture intercontinentali", 4, "JV transatlantiche e transpacifiche."),
  feature("MEDIUM_CARRIER_ACQUISITION", "M&A airline medie", 4, "Acquisizione di legacy weak e regional."),
  feature("MARKET_INTEL_T4", "Market Intel Tier 4", 4, "Demand forecaster completo."),
  feature("NDC", "NDC", 4, "Alternativa al GDS."),
  feature("FULL_MRO", "MRO completo in-house", 4, "Manutenzione completa interna."),
  feature("SUBSIDIARY_LCC", "Subsidiary LCC", 4, "Creazione di una controllata low-cost."),
  feature("LOYALTY_SECURITIZATION", "Loyalty securitization", 4, "Programma loyalty come collaterale."),

  feature("IPO", "IPO / quotazione in borsa", 5, "Accesso al mercato azionario."),
  feature("LOYALTY_TIER_4", "Loyalty Tier 4", 5, "Interoperabilità con alliance partner."),
  feature("LARGE_CARRIER_ACQUISITION", "M&A legacy carrier grandi", 5, "Acquisizioni di scala globale."),
  feature("BOND_ISSUANCE", "Bond issuance", 5, "Accesso ai mercati obbligazionari."),
  feature("CARGO_FREIGHTER", "Cargo freighter dedicato", 5, "Flotta cargo dedicata."),
  feature("TERMINAL_OWNERSHIP", "Airport terminal ownership", 5, "Proprietà dei terminal negli hub."),
  feature("FUEL_REFINERY_PARTNERSHIP", "Fuel refinery partnership", 5, "Partnership industriale sul carburante."),
] as const;

function feature(
  id: string,
  label: string,
  unlockedAt: PlayerLevel,
  description: string,
): Feature {
  return { id, label, unlockedAt, description };
}

function activeRoutes(state: GameState) {
  return state.routes.filter((route) => route.status === "active");
}

function monthlyEbitda(state: GameState) {
  return activeRoutes(state).reduce(
    (total, route) => total + (route.margin_monthly ?? 0),
    0,
  );
}

function hubSharePercent(state: GameState) {
  const share = state.player.core_kpis.hub_dominance_pct;
  return share <= 1 ? share * 100 : share;
}

function hasLongHaulWideBody(state: GameState) {
  return state.fleet.some((aircraft) =>
    /(?:a330|a350|a380|b777|777|787)/i.test(aircraft.modelId),
  );
}

function servedContinents(state: GameState) {
  const continents = new Set<string>();

  for (const route of activeRoutes(state)) {
    const origin = state.airports[route.originIata];
    const destination = state.airports[route.destinationIata];
    if (origin) continents.add(origin.continent);
    if (destination) continents.add(destination.continent);
  }

  return continents.size;
}

function nextLevelFor(state: GameState): PlayerLevel | null {
  if (state.player.level === 5) return null;
  return (state.player.level + 1) as PlayerLevel;
}

function qualifiesForNextLevel(state: GameState) {
  const routes = activeRoutes(state).length;
  const ebitda = monthlyEbitda(state);
  const hubShare = hubSharePercent(state);

  switch (state.player.level) {
    case 1:
      return routes >= 8 || ebitda >= 50_000_000;
    case 2:
      return hubShare > 30 || hasLongHaulWideBody(state);
    case 3:
      return hubShare > 50 || ebitda * 12 >= 500_000_000;
    case 4:
      return routes >= 60 && servedContinents(state) >= 3;
    case 5:
      return false;
  }
}

export function checkLevelUp(state: GameState): LevelUpResult | null {
  const newLevel = nextLevelFor(state);
  if (!newLevel || !qualifiesForNextLevel(state)) return null;

  const definition = LEVELS[newLevel - 1];
  const nextDefinition = LEVELS[newLevel];

  return {
    previousLevel: state.player.level,
    newLevel,
    title: definition.name,
    description: definition.description,
    unlockedFeatures: getUnlockedFeatures(newLevel),
    nextObjective: nextDefinition?.unlockCondition ?? null,
  };
}

export function getUnlockedFeatures(level: PlayerLevel): Feature[] {
  return FEATURES.filter((item) => item.unlockedAt === level);
}

export function isFeatureUnlocked(featureId: string, state: GameState): boolean {
  const target = FEATURES.find(
    (item) => item.id === featureId || item.label === featureId,
  );
  return target ? state.player.level >= target.unlockedAt : false;
}

export function getFeaturePrerequisite(featureId: string, state: GameState) {
  const target = FEATURES.find(
    (item) => item.id === featureId || item.label === featureId,
  );
  if (!target || isFeatureUnlocked(target.id, state)) return null;

  const level = LEVELS[target.unlockedAt - 1];
  return `Disponibile al Livello ${target.unlockedAt} · ${level.unlockCondition}`;
}

function metric(
  id: string,
  label: string,
  current: number,
  target: number,
  unit = "",
  strict = false,
): ProgressMetric {
  return {
    id,
    label,
    current,
    target,
    unit,
    complete: strict ? current > target : current >= target,
  };
}

function percent(current: number, target: number) {
  if (target <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

export function getNextLevelProgress(state: GameState): NextLevelProgress | null {
  const targetLevel = nextLevelFor(state);
  if (!targetLevel) return null;

  const routeCount = activeRoutes(state).length;
  const ebitda = monthlyEbitda(state);
  const hubShare = hubSharePercent(state);
  const longHaul = hasLongHaulWideBody(state) ? 1 : 0;
  const continents = servedContinents(state);
  let metrics: ProgressMetric[] = [];
  let overallPercent = 0;
  let missing = "";

  switch (targetLevel) {
    case 2:
      metrics = [
        metric("ACTIVE_ROUTES", "Rotte attive", routeCount, 8),
        metric("EBITDA_MONTHLY", "EBITDA mensile", ebitda, 50_000_000, "$"),
      ];
      overallPercent = Math.max(percent(routeCount, 8), percent(ebitda, 50_000_000));
      missing = "8 rotte attive oppure $50M EBITDA mensile";
      break;
    case 3:
      metrics = [
        metric("HUB_SHARE", "Hub share", hubShare, 30, "%", true),
        metric("WIDE_BODY_LONG_HAUL", "Wide-body long-haul", longHaul, 1),
      ];
      overallPercent = Math.max(percent(hubShare, 30), percent(longHaul, 1));
      missing = "hub share >30% oppure il primo wide-body long-haul";
      break;
    case 4:
      metrics = [
        metric("HUB_SHARE", "Hub share", hubShare, 50, "%", true),
        metric("EBITDA_ANNUALIZED", "EBITDA annualizzato", ebitda * 12, 500_000_000, "$"),
      ];
      overallPercent = Math.max(percent(hubShare, 50), percent(ebitda * 12, 500_000_000));
      missing = "hub fortress >50% oppure $500M EBITDA annualizzato";
      break;
    case 5:
      metrics = [
        metric("ACTIVE_ROUTES", "Rotte attive", routeCount, 60),
        metric("CONTINENTS", "Continenti serviti", continents, 3),
      ];
      overallPercent = Math.min(percent(routeCount, 60), percent(continents, 3));
      missing = "60 rotte attive su almeno 3 continenti";
      break;
  }

  const definition = LEVELS[targetLevel - 1];
  return {
    targetLevel,
    targetName: definition.name,
    condition: definition.unlockCondition,
    metrics,
    overallPercent,
    recommendation: `Sei al ${overallPercent}% per il L${targetLevel} — manca solo ${missing}.`,
  };
}

function routeDistance(state: GameState, route: Route) {
  const origin = state.airports[route.originIata];
  const destination = state.airports[route.destinationIata];
  if (!origin || !destination) return 0;
  return calculateDistanceKm(origin.coordinates, destination.coordinates);
}

function hasProfitableRouteForThreeTurns(state: GameState) {
  return state.routes.some((route) => {
    const recent = route.performanceHistory.slice(-3);
    return recent.length === 3 && recent.every((report) => report.profit > 0);
  });
}

function hasEvent(state: GameState, type: string) {
  return state.events_log.some((event) => event.type === type);
}

export function getMilestoneProgress(state: GameState): MilestoneProgress[] {
  const hubShare = hubSharePercent(state);
  const longHaulCount = activeRoutes(state).filter(
    (route) => routeDistance(state, route) > 6_000,
  ).length;
  const annualEbitda = monthlyEbitda(state) * 12;

  return [
    milestone({
      id: "FIRST_PROFITABLE_ROUTE",
      title: "Prima Rotta Redditizia",
      description: "Rotta profittevole per 3 turni consecutivi",
      narrative: "La tua prima rotta copre i costi. Il mercato inizia a fidarsi di te.",
      reward: "$5M bonus · Sblocca Metasearch",
      achieved: hasProfitableRouteForThreeTurns(state),
      current: hasProfitableRouteForThreeTurns(state) ? 3 : 0,
      target: 3,
      unit: " turni",
      requiredLevel: 1,
      state,
    }),
    milestone({
      id: "FIRST_HUB",
      title: "Il Tuo Primo Hub",
      description: "30% market share in un aeroporto L2",
      narrative: "Controlli il 30% dei movimenti. Stai diventando parte del tessuto locale.",
      reward: "Sblocca Hub Wave Structure · Loyalty Tier 2",
      achieved: hubShare >= 30,
      current: hubShare,
      target: 30,
      unit: "%",
      requiredLevel: 2,
      state,
    }),
    milestone({
      id: "FIRST_LONGHAUL",
      title: "Oltre l'Oceano",
      description: "Prima rotta oltre 6.000 km",
      narrative: "Il tuo primo volo intercontinentale decolla. Sei un carrier globale.",
      reward: "Sblocca wide-body LH · Corporate sales",
      achieved: longHaulCount > 0,
      current: longHaulCount,
      target: 1,
      unit: " rotta",
      requiredLevel: 2,
      state,
    }),
    milestone({
      id: "FIRST_ACQUISITION",
      title: "Prima Acquisizione",
      description: "M&A completato",
      narrative: "Hai acquisito un competitor. Il network si amplia di colpo.",
      reward: "Sblocca Holding Structure",
      achieved: hasEvent(state, "MA_COMPLETED"),
      current: hasEvent(state, "MA_COMPLETED") ? 1 : 0,
      target: 1,
      unit: "",
      requiredLevel: 3,
      state,
    }),
    milestone({
      id: "FORTRESS_HUB",
      title: "Fortezza",
      description: "65% market share in un aeroporto",
      narrative: "Nessun competitor oserebbe sfidarti qui. Il tuo hub è impenetrabile.",
      reward: "+5% hub premium · −30% deterrenza competitor",
      achieved: hubShare >= 65,
      current: hubShare,
      target: 65,
      unit: "%",
      requiredLevel: 3,
      state,
    }),
    milestone({
      id: "IPO",
      title: "Quotazione in Borsa",
      description: "$1B EBITDA annualizzato",
      narrative: "AeroGrid entra in borsa. Il mondo ti guarda.",
      reward: "$2B cash infusion · Bond issuance",
      achieved: annualEbitda >= 1_000_000_000,
      current: annualEbitda,
      target: 1_000_000_000,
      unit: "$",
      requiredLevel: 4,
      state,
    }),
  ];
}

function milestone(input: Omit<MilestoneProgress, "status"> & {
  achieved: boolean;
  state: GameState;
}): MilestoneProgress {
  const { achieved, state, ...definition } = input;
  return {
    ...definition,
    status:
      state.player.level < definition.requiredLevel
        ? "LOCKED"
        : achieved
          ? "ACHIEVED"
          : "IN_PROGRESS",
  };
}
