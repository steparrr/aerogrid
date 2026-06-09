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
  | "utilization"
  | "invalid-coordinates"
  | "invalid-range"
  | "invalid-runway-requirement"
  | "invalid-origin-runway"
  | "invalid-destination-runway";

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

function hasValidCoordinates({ lat, lon }: Airport["coordinates"]) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function checkRouteCompatibility({
  model,
  origin,
  destination,
  aircraft,
}: RouteCompatibilityInput): RouteCompatibilityResult {
  const reasons: CompatibilityReason[] = [];
  const coordinatesValid =
    hasValidCoordinates(origin.coordinates) &&
    hasValidCoordinates(destination.coordinates);
  const rangeValid = isFinitePositive(model.rangeKm);
  const runwayRequirementValid = isFinitePositive(model.runwayRequirementM);
  const originRunwayValid = isFinitePositive(origin.runwayLengthM);
  const destinationRunwayValid = isFinitePositive(destination.runwayLengthM);

  if (!coordinatesValid) {
    reasons.push("invalid-coordinates");
  }

  if (!rangeValid) {
    reasons.push("invalid-range");
  }

  if (!runwayRequirementValid) {
    reasons.push("invalid-runway-requirement");
  }

  if (!originRunwayValid) {
    reasons.push("invalid-origin-runway");
  }

  if (!destinationRunwayValid) {
    reasons.push("invalid-destination-runway");
  }

  if (
    coordinatesValid &&
    rangeValid &&
    model.rangeKm <
      calculateDistanceKm(origin.coordinates, destination.coordinates) *
        OPERATIONAL_RANGE_RESERVE
  ) {
    reasons.push("range");
  }

  if (
    runwayRequirementValid &&
    originRunwayValid &&
    origin.runwayLengthM < model.runwayRequirementM
  ) {
    reasons.push("origin-runway");
  }

  if (
    runwayRequirementValid &&
    destinationRunwayValid &&
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
