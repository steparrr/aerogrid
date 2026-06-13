import { airports } from "../data/airports";
import type {
  CarbonScore,
  CoreKPIs,
  GameDate,
  GameState,
  PlayerAirline,
} from "../domain/types";

export const DEFAULT_MARKET_FUEL_PRICE = (0.65 + 0.95) / 2;

const airportRecord = Object.fromEntries(
  airports.map((airport) => [airport.iata, airport]),
);

export function gameDateFromIso(value: string): GameDate {
  const [year = 0, month = 1] = value.split("-").map(Number);
  return { year, month };
}

function neutralCarbonScore(): CarbonScore {
  return {
    rating: "B",
    emissions_per_pax_km: 0,
    industry_benchmark: 0,
    corsia_monthly: 0,
    ets_monthly: 0,
    saf_blend_pct: 0,
    total_compliance_cost_monthly: 0,
    emissionsPerPaxKm: 0,
    industryBenchmark: 0,
    corsiaMonthly: 0,
    etsMonthly: 0,
    safBlendPct: 0,
    totalComplianceCostMonthly: 0,
  };
}

function neutralKpis(): CoreKPIs {
  return {
    load_factor_avg: 0,
    otp_rate: 0,
    aircraft_utilization: 0,
    cask: 0,
    rask: 0,
    ebitda_margin: 0,
    net_debt_to_ebitda: 0,
    nps: 0,
    brand_score: 0,
    ancillary_per_pax: 0,
    hub_dominance_pct: 0,
    loyalty_tier: 0,
    fleet_utilization_efficiency: 0,
    carbon_score_rating: "B",
    saf_blend_pct: 0,
  };
}

function synchronizePlayer(state: GameState, gameDate: GameDate): PlayerAirline {
  const current = state.player;

  return {
    id: current?.id ?? "player",
    name: state.airlineName,
    hub: state.hubIata,
    cash: state.cash,
    debt: current?.debt ?? 0,
    fleet: state.fleet,
    routes: state.routes,
    slots: current?.slots ?? [],
    loyalty: current?.loyalty ?? {
      tier: 0,
      miles_outstanding: 0,
      breakage_rate: 0,
      milesOutstanding: 0,
      breakageRate: 0,
    },
    distribution: current?.distribution ?? {
      channels: ["DIRECT"],
      channel_mix: { DIRECT: 100 },
      channelMix: { DIRECT: 100 },
    },
    staff: current?.staff ?? {
      pilots_available: 0,
      pilots_required: 0,
      pilots_in_training: 0,
      union_morale: 0,
      union_contract_expires_turn: 0,
      strike_risk: 0,
    },
    brand_score: current?.brand_score ?? 0,
    nps: current?.nps ?? 0,
    carbon_score: current?.carbon_score ?? neutralCarbonScore(),
    game_date: gameDate,
    level: current?.level ?? 1,
    core_kpis: current?.core_kpis ?? neutralKpis(),
    fuel_hedges: current?.fuel_hedges ?? [],
    maintenance_events: current?.maintenance_events ?? [],
  };
}

export function synchronizeGameState(state: GameState): GameState {
  const gameDate = state.game_date ?? gameDateFromIso(state.currentDate);
  const competitors = state.npcAirlines.map((npc) => ({
    ...state.competitors?.find((competitor) => competitor.id === npc.id),
    ...npc,
  }));

  return {
    ...state,
    turn: state.turn ?? 0,
    game_date: gameDate,
    player: synchronizePlayer(state, gameDate),
    competitors,
    airports:
      state.airports && Object.keys(state.airports).length > 0
        ? state.airports
        : airportRecord,
    market_fuel_price: state.market_fuel_price ?? DEFAULT_MARKET_FUEL_PRICE,
    game_mode: state.game_mode ?? "SANDBOX",
    origin: state.origin ?? null,
    victory_path: state.victory_path ?? null,
    events_log: state.events_log ?? [],
    pending_decisions: state.pending_decisions ?? [],
    consecutive_negative_cash_turns:
      state.consecutive_negative_cash_turns ?? 0,
    game_status: state.game_status ?? "ACTIVE",
  };
}
