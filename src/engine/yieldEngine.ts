import type {
  GameDate,
  OverbookingLevel,
  PricingStrategy,
  Route,
} from "../domain/types";

export type BookingPace = "AHEAD" | "ON_TRACK" | "BEHIND";
export type YieldRouteType = "LEISURE" | "BUSINESS" | "MIXED" | "VFR";
export type FareCabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
export type FareClassCode =
  | "Q"
  | "K"
  | "L"
  | "M"
  | "H"
  | "B"
  | "Y"
  | "G"
  | "W"
  | "I"
  | "D"
  | "C"
  | "J"
  | "F"
  | "A";

export interface FareClass {
  code: FareClassCode;
  cabin: FareCabin;
  price: number;
  is_open: boolean;
  always_open: boolean;
}

export interface FareClassUpdate {
  pace: BookingPace;
  strategy: PricingStrategy;
  classes: FareClass[];
  open_classes: FareClassCode[];
  close_classes: FareClassCode[];
  flash_sale_recommended: boolean;
  reason: string;
}

export interface RevenueProjection {
  projected_load_factor: number;
  projected_passengers: number;
  average_fare: number;
  projected_revenue: number;
  baseline_revenue: number;
  delta_vs_baseline: number;
}

type YieldRouteHints = {
  route_type?: YieldRouteType;
  avg_no_show_rate?: number;
  booked_seats?: number;
  days_to_flight?: number;
  competitor_price?: number;
};

const DAY_ANCHORS = [90, 60, 30, 14, 7, 2, 0] as const;
const CURVE_ANCHORS: Record<YieldRouteType, readonly number[]> = {
  LEISURE: [0.2, 0.4, 0.65, 0.8, 0.88, 0.93, 0.95],
  BUSINESS: [0.08, 0.15, 0.25, 0.45, 0.7, 0.9, 0.94],
  MIXED: [0.14, 0.28, 0.45, 0.62, 0.79, 0.92, 0.95],
  VFR: [0.18, 0.35, 0.58, 0.72, 0.84, 0.91, 0.94],
};

const STRATEGY_FARE_MULTIPLIER: Record<PricingStrategy, number> = {
  YIELD_MAXIMIZER: 1.12,
  LOAD_MAXIMIZER: 0.86,
  COMPETITOR_MATCH: 1,
  PRICE_LEADER: 0.9,
  PREMIUM: 1.25,
};

const STRATEGY_TARGET_LOAD: Record<PricingStrategy, number> = {
  YIELD_MAXIMIZER: 0.71,
  LOAD_MAXIMIZER: 0.84,
  COMPETITOR_MATCH: 0.77,
  PRICE_LEADER: 0.82,
  PREMIUM: 0.68,
};

const NO_SHOW_RATE: Record<YieldRouteType, number> = {
  BUSINESS: 0.03,
  LEISURE: 0.12,
  VFR: 0.18,
  MIXED: 0.08,
};

const OVERBOOKING_RISK: Record<OverbookingLevel, number> = {
  OFF: 0,
  CONSERVATIVE: 0.5,
  MODERATE: 0.8,
  AGGRESSIVE: 1.15,
};

const FARE_CLASS_DEFINITIONS: ReadonlyArray<{
  code: FareClassCode;
  cabin: FareCabin;
  multiplier: number;
  alwaysOpen?: boolean;
}> = [
  { code: "Q", cabin: "ECONOMY", multiplier: 0.7 },
  { code: "K", cabin: "ECONOMY", multiplier: 0.82 },
  { code: "L", cabin: "ECONOMY", multiplier: 0.95 },
  { code: "M", cabin: "ECONOMY", multiplier: 1.1 },
  { code: "H", cabin: "ECONOMY", multiplier: 1.3 },
  { code: "B", cabin: "ECONOMY", multiplier: 1.55 },
  { code: "Y", cabin: "ECONOMY", multiplier: 1.9, alwaysOpen: true },
  { code: "I", cabin: "BUSINESS", multiplier: 0.75 },
  { code: "D", cabin: "BUSINESS", multiplier: 0.9 },
  { code: "C", cabin: "BUSINESS", multiplier: 1.05 },
  { code: "J", cabin: "BUSINESS", multiplier: 1.25, alwaysOpen: true },
  { code: "G", cabin: "PREMIUM_ECONOMY", multiplier: 1.55 },
  { code: "W", cabin: "PREMIUM_ECONOMY", multiplier: 2.1 },
  { code: "F", cabin: "FIRST", multiplier: 1.65 },
  { code: "A", cabin: "FIRST", multiplier: 2, alwaysOpen: true },
];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function hints(route: Route) {
  return route as Route & YieldRouteHints;
}

function capacity(route: Route) {
  return Math.max(0, route.economySeats + route.businessSeats);
}

function strategy(route: Route): PricingStrategy {
  return route.pricing_strategy ?? "COMPETITOR_MATCH";
}

function actualLoadFactor(route: Route) {
  const totalSeats = capacity(route);
  const bookedSeats = hints(route).booked_seats;

  if (bookedSeats !== undefined && totalSeats > 0) {
    return clamp(bookedSeats / totalSeats);
  }

  if (route.load_factor !== undefined) {
    return clamp(route.load_factor);
  }

  return clamp(route.performanceHistory.at(-1)?.loadFactor ?? 0);
}

function interpolateCurve(routeType: YieldRouteType, daysToFlight: number) {
  const days = clamp(daysToFlight, 0, 90);
  const values = CURVE_ANCHORS[routeType];

  for (let index = 0; index < DAY_ANCHORS.length - 1; index += 1) {
    const earlierDay = DAY_ANCHORS[index];
    const laterDay = DAY_ANCHORS[index + 1];
    const earlierValue = values[index];
    const laterValue = values[index + 1];

    if (
      earlierDay !== undefined &&
      laterDay !== undefined &&
      earlierValue !== undefined &&
      laterValue !== undefined &&
      days <= earlierDay &&
      days >= laterDay
    ) {
      const progress = (earlierDay - days) / (earlierDay - laterDay);
      return earlierValue + (laterValue - earlierValue) * progress;
    }
  }

  return values.at(-1) ?? 0;
}

function makeBookingCurve(routeType: YieldRouteType) {
  return Object.freeze(
    Array.from({ length: 90 }, (_, index) =>
      interpolateCurve(routeType, 90 - index),
    ),
  );
}

export const BOOKING_CURVES: Readonly<
  Record<YieldRouteType, readonly number[]>
> = Object.freeze({
  LEISURE: makeBookingCurve("LEISURE"),
  BUSINESS: makeBookingCurve("BUSINESS"),
  MIXED: makeBookingCurve("MIXED"),
  VFR: makeBookingCurve("VFR"),
});

export function inferRouteType(route: Route): YieldRouteType {
  if (hints(route).route_type) {
    return hints(route).route_type as YieldRouteType;
  }

  const totalSeats = capacity(route);
  const businessShare = totalSeats > 0 ? route.businessSeats / totalSeats : 0;

  if (businessShare >= 0.18) {
    return "BUSINESS";
  }
  if (businessShare <= 0.08) {
    return "LEISURE";
  }
  return "MIXED";
}

export function getExpectedLoadFactor(
  route: Route,
  daysToFlight: number,
): number {
  return interpolateCurve(inferRouteType(route), daysToFlight);
}

export function evaluateBookingPace(
  route: Route,
  daysToFlight: number,
): BookingPace {
  const delta = actualLoadFactor(route) - getExpectedLoadFactor(route, daysToFlight);

  if (delta > 0.05) {
    return "AHEAD";
  }
  if (delta < -0.05) {
    return "BEHIND";
  }
  return "ON_TRACK";
}

export function buildFareClasses(route: Route): FareClass[] {
  const activeStrategy = strategy(route);
  const fareMultiplier = STRATEGY_FARE_MULTIPLIER[activeStrategy];

  return FARE_CLASS_DEFINITIONS.map((definition) => {
    const cabinBase =
      definition.cabin === "ECONOMY" ||
      definition.cabin === "PREMIUM_ECONOMY"
        ? route.economyPrice
        : route.businessPrice;

    return {
      code: definition.code,
      cabin: definition.cabin,
      price: Math.round(cabinBase * definition.multiplier * fareMultiplier),
      is_open: Boolean(definition.alwaysOpen),
      always_open: Boolean(definition.alwaysOpen),
    };
  });
}

export function adjustFareClasses(
  route: Route,
  pace: BookingPace,
): FareClassUpdate {
  const activeStrategy = strategy(route);
  const open = new Set<FareClassCode>(["Y", "J", "A"]);
  const close = new Set<FareClassCode>();

  if (pace === "BEHIND") {
    ["Q", "K", "L", "M", "G", "I", "D"].forEach((code) =>
      open.add(code as FareClassCode),
    );
  } else if (pace === "AHEAD") {
    ["Q", "K", "L", "G", "I"].forEach((code) =>
      close.add(code as FareClassCode),
    );
    ["H", "B", "W", "C", "F"].forEach((code) =>
      open.add(code as FareClassCode),
    );
  } else {
    ["K", "L", "M", "H", "G", "I", "D"].forEach((code) =>
      open.add(code as FareClassCode),
    );
  }

  if (activeStrategy === "LOAD_MAXIMIZER" || activeStrategy === "PRICE_LEADER") {
    ["Q", "K", "L", "M", "G", "I"].forEach((code) => {
      open.add(code as FareClassCode);
      close.delete(code as FareClassCode);
    });
  }

  if (activeStrategy === "PREMIUM") {
    ["Q", "K", "G", "I"].forEach((code) => {
      close.add(code as FareClassCode);
      open.delete(code as FareClassCode);
    });
    ["B", "Y", "W", "C", "J", "F", "A"].forEach((code) =>
      open.add(code as FareClassCode),
    );
  }

  const classes = buildFareClasses(route).map((fareClass) => ({
    ...fareClass,
    is_open:
      fareClass.always_open ||
      (open.has(fareClass.code) && !close.has(fareClass.code)),
  }));

  return {
    pace,
    strategy: activeStrategy,
    classes,
    open_classes: [...open].filter((code) => !close.has(code)),
    close_classes: [...close],
    flash_sale_recommended:
      pace === "BEHIND" && activeStrategy === "YIELD_MAXIMIZER",
    reason:
      pace === "AHEAD"
        ? "Domanda sopra curva: proteggi inventario ad alto rendimento."
        : pace === "BEHIND"
          ? "Domanda sotto curva: riapri le classi a prezzo più basso."
          : "Domanda in linea: mantieni il mix tariffario corrente.",
  };
}

export function calculateBidPrice(route: Route, flightDate: GameDate): number {
  const activeStrategy = strategy(route);
  const loadFactor = actualLoadFactor(route);
  const daysToFlight = clamp(hints(route).days_to_flight ?? 30, 0, 365);
  const departureMultiplier =
    daysToFlight <= 7 ? 1.35 : daysToFlight <= 14 ? 1.2 : daysToFlight <= 30 ? 1.05 : 0.9;
  const scarcityMultiplier = 0.6 + loadFactor;
  const seasonMultiplier = [6, 7, 8, 12].includes(flightDate.month) ? 1.05 : 1;
  const competitorPrice = hints(route).competitor_price;
  const marketBase =
    activeStrategy === "COMPETITOR_MATCH" && competitorPrice
      ? competitorPrice
      : route.economyPrice;
  const calculated =
    marketBase *
    scarcityMultiplier *
    departureMultiplier *
    seasonMultiplier *
    STRATEGY_FARE_MULTIPLIER[activeStrategy];
  const floor =
    activeStrategy === "PREMIUM" ? route.economyPrice : route.economyPrice * 0.55;

  return Math.round(Math.max(floor, calculated));
}

export function getNoShowRate(route: Route): number {
  return clamp(
    hints(route).avg_no_show_rate ?? NO_SHOW_RATE[inferRouteType(route)],
    0,
    0.3,
  );
}

export function calculateOverbookingLevel(route: Route): number {
  const riskLevel = route.overbooking_level;
  const riskMultiplier =
    riskLevel === undefined ? 0.95 : OVERBOOKING_RISK[riskLevel];
  const expectedNoShows = capacity(route) * getNoShowRate(route);

  return Math.floor(expectedNoShows * riskMultiplier);
}

export function projectFlightRevenue(route: Route): RevenueProjection {
  const activeStrategy = strategy(route);
  const currentLoad = actualLoadFactor(route);
  const pace = evaluateBookingPace(route, hints(route).days_to_flight ?? 30);
  const strategyTarget = STRATEGY_TARGET_LOAD[activeStrategy];
  const projectedLoad =
    pace === "AHEAD"
      ? Math.max(currentLoad, Math.min(0.98, strategyTarget + 0.04))
      : pace === "BEHIND"
        ? Math.max(currentLoad, strategyTarget - 0.08)
        : Math.max(currentLoad, strategyTarget);
  const totalSeats = capacity(route);
  const weightedBaseFare =
    totalSeats > 0
      ? (route.economySeats * route.economyPrice +
          route.businessSeats * route.businessPrice) /
        totalSeats
      : 0;
  const averageFare = Math.round(
    weightedBaseFare * STRATEGY_FARE_MULTIPLIER[activeStrategy],
  );
  const projectedPassengers =
    Math.round(totalSeats * projectedLoad) + calculateOverbookingLevel(route);
  const projectedRevenue = Math.round(projectedPassengers * averageFare);
  const baselineRevenue = Math.round(totalSeats * 0.77 * weightedBaseFare);

  return {
    projected_load_factor: clamp(projectedLoad),
    projected_passengers: projectedPassengers,
    average_fare: averageFare,
    projected_revenue: projectedRevenue,
    baseline_revenue: baselineRevenue,
    delta_vs_baseline: projectedRevenue - baselineRevenue,
  };
}
