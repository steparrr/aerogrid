import type { GameState, RoutePerformance } from "../domain/types";

function latestPerformance(
  history: readonly RoutePerformance[],
): RoutePerformance | undefined {
  return history.at(-1);
}

export function selectLatestReport(state: GameState) {
  return state.reports.daily.at(-1);
}

export function selectRouteRanking(state: GameState) {
  return state.routes
    .map((route) => {
      const performance = latestPerformance(route.performanceHistory);

      return {
        routeId: route.id,
        originIata: route.originIata,
        destinationIata: route.destinationIata,
        status: route.status,
        profit: performance?.profit ?? 0,
        loadFactor: performance?.loadFactor ?? 0,
        passengers: performance?.passengers ?? 0,
      };
    })
    .sort(
      (first, second) =>
        second.profit - first.profit ||
        first.routeId.localeCompare(second.routeId),
    );
}

export function selectFleetUtilization(state: GameState) {
  return state.fleet
    .map((aircraft) => ({
      aircraftId: aircraft.id,
      modelId: aircraft.modelId,
      assignedRoutes: aircraft.assignedRouteIds.length,
      utilizationHoursPerDay: aircraft.utilizationHoursPerDay,
      utilizationRate: Math.min(
        1,
        Math.max(0, aircraft.utilizationHoursPerDay / 16),
      ),
    }))
    .sort(
      (first, second) =>
        second.utilizationHoursPerDay - first.utilizationHoursPerDay ||
        first.aircraftId.localeCompare(second.aircraftId),
    );
}

export function selectFinanceTotals(state: GameState) {
  return state.reports.daily.reduce(
    (totals, report) => ({
      cash: state.cash,
      passengers: totals.passengers + report.passengers,
      revenue: totals.revenue + report.revenue,
      costs: totals.costs + report.costs,
      profit: totals.profit + report.profit,
    }),
    {
      cash: state.cash,
      passengers: 0,
      revenue: 0,
      costs: 0,
      profit: 0,
    },
  );
}

export function selectMobileSummary(state: GameState) {
  return {
    currentDate: state.currentDate,
    cash: state.cash,
    activeRoutes: state.routes.filter((route) => route.status === "active")
      .length,
    fleetSize: state.fleet.length,
    latestProfit: selectLatestReport(state)?.profit ?? 0,
    unreadNotifications: state.notifications.length,
  };
}
