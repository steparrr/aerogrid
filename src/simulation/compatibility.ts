import type { AircraftModel, Airport } from "../domain/types";
import { calculateDistanceKm } from "./geography";

const OPERATIONAL_RANGE_RESERVE = 1.1;
const DEFAULT_MAX_WEEKLY_UTILIZATION_HOURS = 112;

export type CompatibilityReason =
  | "range"
  | "origin-runway"
  | "destination-runway"
  | "freighter"
  | "unavailable"
  | "utilization";

export interface AircraftAvailabilityContext {
  available?: boolean;
  currentWeeklyUtilizationHours?: number;
  proposedWeeklyUtilizationHours?: number;
  maxWeeklyUtilizationHours?: number;
}

export interface RouteCompatibilityInput {
  model: AircraftModel;
  origin: Airport;
  destination: Airport;
  aircraft?: AircraftAvailabilityContext;
}

export interface RouteCompatibilityResult {
  compatible: boolean;
  reasons: CompatibilityReason[];
}

function hasInvalidUtilization(context: AircraftAvailabilityContext) {
  const current = context.currentWeeklyUtilizationHours ?? 0;
  const proposed = context.proposedWeeklyUtilizationHours ?? 0;
  const maximum =
    context.maxWeeklyUtilizationHours ?? DEFAULT_MAX_WEEKLY_UTILIZATION_HOURS;

  return (
    !Number.isFinite(current) ||
    !Number.isFinite(proposed) ||
    !Number.isFinite(maximum) ||
    current < 0 ||
    proposed < 0 ||
    maximum < 0 ||
    current + proposed > maximum
  );
}

export function checkRouteCompatibility({
  model,
  origin,
  destination,
  aircraft,
}: RouteCompatibilityInput): RouteCompatibilityResult {
  const reasons: CompatibilityReason[] = [];
  const distanceKm = calculateDistanceKm(
    origin.coordinates,
    destination.coordinates,
  );

  if (
    !Number.isFinite(model.rangeKm) ||
    model.rangeKm < distanceKm * OPERATIONAL_RANGE_RESERVE
  ) {
    reasons.push("range");
  }

  if (
    !Number.isFinite(origin.runwayLengthM) ||
    origin.runwayLengthM < model.runwayRequirementM
  ) {
    reasons.push("origin-runway");
  }

  if (
    !Number.isFinite(destination.runwayLengthM) ||
    destination.runwayLengthM < model.runwayRequirementM
  ) {
    reasons.push("destination-runway");
  }

  if (model.role === "freighter") {
    reasons.push("freighter");
  }

  if (aircraft?.available === false) {
    reasons.push("unavailable");
  }

  if (aircraft && hasInvalidUtilization(aircraft)) {
    reasons.push("utilization");
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  };
}
