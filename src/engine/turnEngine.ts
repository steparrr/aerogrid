import type {
  Aircraft,
  CoreKPIs,
  GameDate,
  GameEvent,
  GameState,
  Route,
  SlotAsset,
} from "../domain/types";
import { synchronizeGameState } from "../game/stateSync";
import { advanceDays } from "../simulation/advance";

const FUEL_PRICE_MIN = 0.65;
const FUEL_PRICE_MAX = 0.95;
const AOG_MONTHLY_PROBABILITY = 0.3;
const AOG_COST_PER_MINUTE = 120;

export function advanceGameDate(date: GameDate): GameDate {
  return date.month === 12
    ? { year: date.year + 1, month: 1 }
    : { year: date.year, month: date.month + 1 };
}

function deterministicUnit(seed: string): number {
  let hash = 2_166_136_261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 0xffffffff;
}

export function updateFuelBenchmark(currentPrice: number, turn: number): number {
  const unit = deterministicUnit(`fuel:${turn}`);
  const variation = 0.05 + unit * 0.1;
  const direction = deterministicUnit(`fuel-direction:${turn}`) >= 0.5 ? 1 : -1;
  const next = currentPrice * (1 + direction * variation);

  return Math.round(
    Math.min(FUEL_PRICE_MAX, Math.max(FUEL_PRICE_MIN, next)) * 10_000,
  ) / 10_000;
}

export function updateSlotStatuses(slots: readonly SlotAsset[]): SlotAsset[] {
  return slots.map((slot) => ({
    ...slot,
    status:
      slot.status === "LOST"
        ? "LOST"
        : (slot.utilization_this_season ?? slot.utilizationThisSeason ?? 0) < 0.8
          ? "AT_RISK"
          : "ACTIVE",
  }));
}

function daysUntilNextMonthSameDay(currentDate: string): number {
  const current = new Date(`${currentDate}T00:00:00.000Z`);
  const next = new Date(current);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return Math.max(1, Math.round((next.getTime() - current.getTime()) / 86_400_000));
}

function recentRouteResults(route: Route, days: number) {
  return route.performanceHistory.slice(-days);
}

export function calculateRouteMonthlyDemand(route: Route, days: number): number {
  return recentRouteResults(route, days).reduce(
    (total, performance) => total + performance.passengers,
    0,
  );
}

export function calculateRouteMonthlyRevenue(route: Route, days: number): number {
  return recentRouteResults(route, days).reduce(
    (total, performance) => total + performance.revenue,
    0,
  );
}

export function calculateRouteMonthlyCost(route: Route, days: number): number {
  return recentRouteResults(route, days).reduce(
    (total, performance) => total + performance.costs,
    0,
  );
}

export function summarizeRouteMonth(route: Route, days: number): Route {
  const results = recentRouteResults(route, days);
  const loadFactor =
    results.length > 0
      ? results.reduce((total, result) => total + result.loadFactor, 0) /
        results.length
      : 0;
  const revenue = calculateRouteMonthlyRevenue(route, days);
  const cost = calculateRouteMonthlyCost(route, days);

  return {
    ...route,
    load_factor: loadFactor,
    revenue_monthly: revenue,
    cost_monthly: cost,
    margin_monthly: revenue - cost,
  };
}

export function updateMaintenanceCounters(
  fleet: readonly Aircraft[],
  turn: number,
): { fleet: Aircraft[]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const updatedFleet = fleet.map((aircraft) => {
    const nextCCheck =
      aircraft.maintenance_next_c_check === undefined
        ? undefined
        : Math.max(0, aircraft.maintenance_next_c_check - 1);
    const nextDCheck =
      aircraft.maintenance_next_d_check === undefined
        ? undefined
        : Math.max(0, aircraft.maintenance_next_d_check - 1);

    if (
      (aircraft.maintenance_next_c_check ?? 1) > 0 &&
      nextCCheck === 0
    ) {
      events.push({
        id: `maintenance-c-${aircraft.id}-${turn}`,
        turn,
        type: "MAINTENANCE_DUE",
        message: `C-check due for ${aircraft.id}`,
        payload: { aircraft_id: aircraft.id, check_type: "C_CHECK" },
      });
    }

    if (
      (aircraft.maintenance_next_d_check ?? 1) > 0 &&
      nextDCheck === 0
    ) {
      events.push({
        id: `maintenance-d-${aircraft.id}-${turn}`,
        turn,
        type: "MAINTENANCE_DUE",
        message: `D-check due for ${aircraft.id}`,
        payload: { aircraft_id: aircraft.id, check_type: "D_CHECK" },
      });
    }

    return {
      ...aircraft,
      maintenance_next_c_check: nextCCheck,
      maintenance_next_d_check: nextDCheck,
    };
  });

  return { fleet: updatedFleet, events };
}

export function rollAogEvents(
  fleet: readonly Aircraft[],
  turn: number,
): { events: GameEvent[]; cost: number } {
  const events: GameEvent[] = [];
  let cost = 0;

  for (const aircraft of fleet) {
    if (
      aircraft.utilizationHoursPerDay <= 0 ||
      deterministicUnit(`aog:${aircraft.id}:${turn}`) >= AOG_MONTHLY_PROBABILITY
    ) {
      continue;
    }

    const cancelledMinutes = Math.round(aircraft.utilizationHoursPerDay * 60);
    const directCost = cancelledMinutes * AOG_COST_PER_MINUTE;
    cost += directCost;
    events.push({
      id: `aog-${aircraft.id}-${turn}`,
      turn,
      type: "AOG",
      message: `${aircraft.id} grounded by an AOG event`,
      payload: {
        aircraft_id: aircraft.id,
        cancelled_minutes: cancelledMinutes,
        direct_cost: directCost,
      },
    });
  }

  return { events, cost };
}

export function calculateCoreKpis(state: GameState, days: number): CoreKPIs {
  const reports = state.reports.daily.slice(-days);
  const routeResults = reports.flatMap((report) => report.routeResults);
  const revenue = reports.reduce((total, report) => total + report.revenue, 0);
  const costs = reports.reduce((total, report) => total + report.costs, 0);
  const passengers = reports.reduce(
    (total, report) => total + report.passengers,
    0,
  );
  const availableSeatKm = routeResults.reduce(
    (total, result) => total + result.availableSeatKm,
    0,
  );
  const averageLoadFactor =
    routeResults.length > 0
      ? routeResults.reduce((total, result) => total + result.loadFactor, 0) /
        routeResults.length
      : 0;
  const utilization =
    state.fleet.length > 0
      ? state.fleet.reduce(
          (total, aircraft) => total + aircraft.utilizationHoursPerDay,
          0,
        ) / state.fleet.length
      : 0;

  return {
    load_factor_avg: averageLoadFactor,
    otp_rate: state.player.core_kpis.otp_rate,
    aircraft_utilization: utilization,
    cask: availableSeatKm > 0 ? costs / availableSeatKm : 0,
    rask: availableSeatKm > 0 ? revenue / availableSeatKm : 0,
    ebitda_margin: revenue > 0 ? (revenue - costs) / revenue : 0,
    net_debt_to_ebitda: state.player.core_kpis.net_debt_to_ebitda,
    nps: state.player.nps,
    brand_score: state.player.brand_score,
    ancillary_per_pax: passengers > 0 ? 24 : 0,
    hub_dominance_pct: state.player.core_kpis.hub_dominance_pct,
    loyalty_tier: state.player.loyalty.tier,
    fleet_utilization_efficiency: utilization,
    carbon_score_rating: state.player.carbon_score.rating,
    saf_blend_pct: state.player.carbon_score.saf_blend_pct ?? 0,
  };
}

export function checkLevelProgression(state: GameState): GameState["player"]["level"] {
  const current = state.player.level;
  const activeRoutes = state.routes.filter((route) => route.status === "active");
  const monthlyEbitda = activeRoutes.reduce(
    (total, route) => total + (route.margin_monthly ?? 0),
    0,
  );

  if (current === 1 && (activeRoutes.length >= 8 || monthlyEbitda >= 50_000_000)) {
    return 2;
  }

  if (
    current === 2 &&
    (state.player.core_kpis.hub_dominance_pct > 0.3 ||
      state.fleet.some((aircraft) => aircraftModelIsLongHaul(state, aircraft)))
  ) {
    return 3;
  }

  if (
    current === 3 &&
    (state.player.core_kpis.hub_dominance_pct > 0.5 ||
      monthlyEbitda * 12 >= 500_000_000)
  ) {
    return 4;
  }

  if (current === 4 && activeRoutes.length >= 60) {
    return 5;
  }

  return current;
}

function aircraftModelIsLongHaul(state: GameState, aircraft: Aircraft) {
  const model = state.player.fleet.find((item) => item.id === aircraft.id);
  return Boolean(model?.modelId.includes("787") || model?.modelId.includes("a350"));
}

export function processTurn(input: GameState): GameState {
  const state = synchronizeGameState(input);
  const nextTurn = state.turn + 1;
  const nextGameDate = advanceGameDate(state.game_date);
  const days = daysUntilNextMonthSameDay(state.currentDate);
  const simulated = synchronizeGameState(advanceDays(state, days));
  const routes = simulated.routes.map((route) => summarizeRouteMonth(route, days));
  const maintenance = updateMaintenanceCounters(simulated.fleet, nextTurn);
  const aog = rollAogEvents(maintenance.fleet, nextTurn);
  const slots = updateSlotStatuses(state.player.slots);
  const cash = simulated.cash - aog.cost;
  const consecutiveNegativeCashTurns =
    cash < 0 ? state.consecutive_negative_cash_turns + 1 : 0;
  const bankruptcyEvent: GameEvent[] =
    consecutiveNegativeCashTurns >= 2 && state.game_status !== "BANKRUPT"
      ? [
          {
            id: `bankruptcy-${nextTurn}`,
            turn: nextTurn,
            type: "BANKRUPTCY",
            message: "Cash remained negative for two consecutive turns",
          },
        ]
      : [];
  const draft = synchronizeGameState({
    ...simulated,
    turn: nextTurn,
    game_date: nextGameDate,
    routes,
    fleet: maintenance.fleet,
    cash,
    market_fuel_price: updateFuelBenchmark(state.market_fuel_price, nextTurn),
    events_log: [
      ...state.events_log,
      ...maintenance.events,
      ...aog.events,
      ...bankruptcyEvent,
    ],
    consecutive_negative_cash_turns: consecutiveNegativeCashTurns,
    game_status:
      consecutiveNegativeCashTurns >= 2 ? "BANKRUPT" : state.game_status,
    player: {
      ...state.player,
      slots,
      routes,
      fleet: maintenance.fleet,
      cash,
      game_date: nextGameDate,
    },
  });
  const coreKpis = calculateCoreKpis(draft, days);
  const withKpis = synchronizeGameState({
    ...draft,
    player: {
      ...draft.player,
      core_kpis: coreKpis,
    },
  });
  const level = checkLevelProgression(withKpis);

  return synchronizeGameState({
    ...withKpis,
    player: { ...withKpis.player, level },
  });
}
