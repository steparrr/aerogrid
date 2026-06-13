import { aircraftModelById, airportByIata } from "../data/indexes";
import type {
  AircraftAsset,
  AircraftModel,
  GameDate,
  Route,
} from "../domain/types";
import { calculateBlockTime, calculateDistanceKm } from "../simulation/geography";

const MINUTES_PER_DAY = 24 * 60;
const MAX_ANNUAL_FLIGHT_HOURS = 900;
const MAX_DAILY_DUTY_HOURS = 13;
const DELAY_COST_PER_MINUTE = 120;

export interface FlightLeg {
  id: string;
  route_id: string;
  origin: string;
  destination: string;
  scheduled_departure_minute: number;
  scheduled_arrival_minute: number;
  actual_departure_minute: number;
  actual_arrival_minute: number;
  block_minutes: number;
  turnaround_minutes: number;
  delay_minutes: number;
  passengers?: number;
}

export interface DailyRotation {
  aircraft_id: string;
  date: GameDate;
  flights: FlightLeg[];
  total_block_hours: number;
  total_ground_time: number;
  utilization_pct: number;
  delay_minutes_accumulated: number;
  ftl_compliant: boolean;
  target_block_hours: number;
}

export interface UtilizationMetrics {
  aircraft_id: string;
  block_hours: number;
  ground_hours: number;
  utilization_pct: number;
  target_block_hours: number;
  target_achievement_pct: number;
}

export interface CrewAssignment {
  id: string;
  annual_flight_hours: number;
  duty_hours_before_rotation: number;
}

export interface FTLStatus {
  compliant: boolean;
  annual_limit_exceeded: boolean;
  daily_duty_limit_exceeded: boolean;
  annual_hours_after_rotation: number;
  duty_hours_after_rotation: number;
}

export type UtilizationAlert = "OVERUTILIZATION" | "UNDERUTILIZATION";

function routeDistanceKm(route: Route) {
  const origin = airportByIata.get(route.originIata);
  const destination = airportByIata.get(route.destinationIata);

  return origin && destination
    ? calculateDistanceKm(origin.coordinates, destination.coordinates)
    : 0;
}

function isWideBody(model: AircraftModel) {
  return model.economyCapacity + model.businessCapacity >= 250;
}

function isLccRoute(route: Route) {
  return (
    route.pricing_strategy === "PRICE_LEADER" ||
    route.pricing_strategy === "LOAD_MAXIMIZER"
  );
}

function targetBlockHours(model: AircraftModel, routes: readonly Route[]) {
  if (isWideBody(model)) {
    return routes.some((route) => routeDistanceKm(route) > 4_500) ? 16 : 13;
  }

  return routes.some(isLccRoute) ? 12 : 10;
}

export function calculateTurnaroundMinutes(
  aircraft: AircraftAsset,
  route: Route,
  atBase: boolean,
): number {
  const model = aircraftModelById.get(aircraft.modelId);

  if (!model) {
    return 0;
  }

  if (!isWideBody(model) && isLccRoute(route)) {
    return atBase ? 22.5 : 32.5;
  }

  const midpoint = !isWideBody(model)
    ? 60
    : routeDistanceKm(route) > 4_500
      ? 180
      : 105;

  return atBase ? midpoint - 10 : midpoint;
}

function minuteOfDay(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function blockMinutes(route: Route, model: AircraftModel) {
  return Math.round(
    calculateBlockTime(routeDistanceKm(route), model.cruiseSpeedKmh) * 60,
  );
}

function routeDate(route: Route): GameDate {
  return route.opened_date ?? { year: 0, month: 1 };
}

export function buildDailyRotation(
  aircraft: AircraftAsset,
  routes: Route[],
): DailyRotation {
  const assignedRoutes = routes
    .filter(
      (route) =>
        route.aircraftId === aircraft.id && route.status === "active",
    )
    .sort(
      (left, right) =>
        minuteOfDay(left.departureTime) - minuteOfDay(right.departureTime),
    );
  const model = aircraftModelById.get(aircraft.modelId);

  if (!model) {
    return {
      aircraft_id: aircraft.id,
      date: assignedRoutes[0] ? routeDate(assignedRoutes[0]) : { year: 0, month: 1 },
      flights: [],
      total_block_hours: 0,
      total_ground_time: 0,
      utilization_pct: 0,
      delay_minutes_accumulated: 0,
      ftl_compliant: true,
      target_block_hours: 0,
    };
  }

  const flights: FlightLeg[] = [];
  let aircraftAvailableMinute = 0;

  for (const route of assignedRoutes) {
    const duration = blockMinutes(route, model);
    const outboundDeparture = Math.max(
      minuteOfDay(route.departureTime),
      aircraftAvailableMinute,
    );
    const outboundArrival = outboundDeparture + duration;
    const outstationTurnaround = calculateTurnaroundMinutes(
      aircraft,
      route,
      false,
    );
    const returnDeparture = outboundArrival + outstationTurnaround;
    const returnArrival = returnDeparture + duration;
    const baseTurnaround = calculateTurnaroundMinutes(aircraft, route, true);

    flights.push(
      {
        id: `${route.id}-outbound`,
        route_id: route.id,
        origin: route.originIata,
        destination: route.destinationIata,
        scheduled_departure_minute: outboundDeparture,
        scheduled_arrival_minute: outboundArrival,
        actual_departure_minute: outboundDeparture,
        actual_arrival_minute: outboundArrival,
        block_minutes: duration,
        turnaround_minutes: outstationTurnaround,
        delay_minutes: 0,
      },
      {
        id: `${route.id}-return`,
        route_id: route.id,
        origin: route.destinationIata,
        destination: route.originIata,
        scheduled_departure_minute: returnDeparture,
        scheduled_arrival_minute: returnArrival,
        actual_departure_minute: returnDeparture,
        actual_arrival_minute: returnArrival,
        block_minutes: duration,
        turnaround_minutes: baseTurnaround,
        delay_minutes: 0,
      },
    );

    aircraftAvailableMinute = returnArrival + baseTurnaround;
  }

  const totalBlockMinutes = flights.reduce(
    (total, flight) => total + flight.block_minutes,
    0,
  );
  const totalGroundMinutes = flights
    .slice(0, -1)
    .reduce((total, flight) => total + flight.turnaround_minutes, 0);

  return {
    aircraft_id: aircraft.id,
    date: assignedRoutes[0] ? routeDate(assignedRoutes[0]) : { year: 0, month: 1 },
    flights,
    total_block_hours: totalBlockMinutes / 60,
    total_ground_time: totalGroundMinutes / 60,
    utilization_pct: totalBlockMinutes / MINUTES_PER_DAY,
    delay_minutes_accumulated: 0,
    ftl_compliant: true,
    target_block_hours: targetBlockHours(model, assignedRoutes),
  };
}

export function calculateUtilization(
  rotation: DailyRotation,
): UtilizationMetrics {
  return {
    aircraft_id: rotation.aircraft_id,
    block_hours: rotation.total_block_hours,
    ground_hours: rotation.total_ground_time,
    utilization_pct: rotation.utilization_pct,
    target_block_hours: rotation.target_block_hours,
    target_achievement_pct:
      rotation.target_block_hours > 0
        ? rotation.total_block_hours / rotation.target_block_hours
        : 0,
  };
}

export function propagateDelay(
  rotation: DailyRotation,
  initialDelay: number,
  flightIndex: number,
): DailyRotation {
  if (
    initialDelay <= 0 ||
    flightIndex < 0 ||
    flightIndex >= rotation.flights.length
  ) {
    return {
      ...rotation,
      flights: rotation.flights.map((flight) => ({ ...flight })),
    };
  }

  const flights = rotation.flights.map((flight) => ({ ...flight }));
  const first = flights[flightIndex];

  if (!first) {
    return { ...rotation, flights };
  }

  first.delay_minutes = initialDelay;
  first.actual_departure_minute =
    first.scheduled_departure_minute + initialDelay;
  first.actual_arrival_minute = first.scheduled_arrival_minute + initialDelay;

  for (let index = flightIndex + 1; index < flights.length; index += 1) {
    const previous = flights[index - 1];
    const current = flights[index];

    if (!previous || !current) {
      continue;
    }

    const earliestDeparture =
      previous.actual_arrival_minute + previous.turnaround_minutes;
    current.actual_departure_minute = Math.max(
      current.scheduled_departure_minute,
      earliestDeparture,
    );
    current.delay_minutes =
      current.actual_departure_minute - current.scheduled_departure_minute;
    current.actual_arrival_minute =
      current.scheduled_arrival_minute + current.delay_minutes;
  }

  return {
    ...rotation,
    flights,
    delay_minutes_accumulated: flights.reduce(
      (total, flight) => total + flight.delay_minutes,
      0,
    ),
  };
}

export function calculateDelayCost(
  delayMinutes: number,
  aircraft: AircraftAsset,
): number {
  const model = aircraftModelById.get(aircraft.modelId);
  const scaleFactor = !model || !isWideBody(model)
    ? 1
    : model.rangeKm >= 9_000
      ? 2.1
      : 1.6;

  return Math.max(0, delayMinutes) * DELAY_COST_PER_MINUTE * scaleFactor;
}

export function checkFTLCompliance(
  rotation: DailyRotation,
  crew: CrewAssignment,
): FTLStatus {
  const annualHoursAfterRotation =
    crew.annual_flight_hours + rotation.total_block_hours;
  const dutyHoursAfterRotation =
    crew.duty_hours_before_rotation +
    rotation.total_block_hours +
    rotation.total_ground_time;
  const annualLimitExceeded =
    annualHoursAfterRotation > MAX_ANNUAL_FLIGHT_HOURS;
  const dailyDutyLimitExceeded = dutyHoursAfterRotation > MAX_DAILY_DUTY_HOURS;

  return {
    compliant: !annualLimitExceeded && !dailyDutyLimitExceeded,
    annual_limit_exceeded: annualLimitExceeded,
    daily_duty_limit_exceeded: dailyDutyLimitExceeded,
    annual_hours_after_rotation: annualHoursAfterRotation,
    duty_hours_after_rotation: dutyHoursAfterRotation,
  };
}

export function getUtilizationAlert(
  metrics: UtilizationMetrics,
): UtilizationAlert | null {
  if (metrics.target_achievement_pct > 0.9) {
    return "OVERUTILIZATION";
  }

  if (metrics.target_achievement_pct < 0.5) {
    return "UNDERUTILIZATION";
  }

  return null;
}
