import { aircraftModelById } from "../data/indexes";
import type { AircraftAsset } from "../domain/types";
import type { FlightLeg } from "./rotationsEngine";

const A_CHECK_DUE_HOURS = 400;
const AOG_BASE_PROBABILITY = 0.3;
const AOG_COST_PER_MINUTE = 120;

export interface MaintenanceSchedule {
  check_type: "A_CHECK" | "C_CHECK" | "D_CHECK" | "NONE";
  due: boolean;
  remaining_hours?: number;
  remaining_turns?: number;
}

export interface MaintenanceResult {
  aircraft: AircraftAsset;
  cost: number;
  duration_hours?: number;
  duration_days?: number;
}

export interface AOGEvent {
  id: string;
  aircraft_id: string;
  duration_minutes: number;
  aircraft_scale_factor: number;
  eu261_per_passenger: number;
}

export interface AOGCost {
  direct_cost: number;
  eu261_cost: number;
  brand_score_damage: number;
  total_cost: number;
}

function deterministicUnit(seed: string): number {
  let hash = 2_166_136_261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 0xffffffff;
}

function isWideBody(aircraft: AircraftAsset) {
  const model = aircraftModelById.get(aircraft.modelId);
  return Boolean(
    model && model.economyCapacity + model.businessCapacity >= 250,
  );
}

function aircraftScaleFactor(aircraft: AircraftAsset) {
  const model = aircraftModelById.get(aircraft.modelId);

  if (!model || !isWideBody(aircraft)) {
    return 1;
  }

  return model.rangeKm >= 9_000 ? 2.1 : 1.6;
}

export function updateMaintenanceCounters(
  aircraft: AircraftAsset,
  hoursFlown: number,
): AircraftAsset {
  const operated = hoursFlown > 0;

  return {
    ...aircraft,
    flight_hours_since_a_check:
      (aircraft.flight_hours_since_a_check ?? 0) + Math.max(0, hoursFlown),
    maintenance_next_c_check:
      aircraft.maintenance_next_c_check === undefined
        ? undefined
        : Math.max(
            0,
            aircraft.maintenance_next_c_check - (operated ? 1 : 0),
          ),
    maintenance_next_d_check:
      aircraft.maintenance_next_d_check === undefined
        ? undefined
        : Math.max(
            0,
            aircraft.maintenance_next_d_check - (operated ? 1 : 0),
          ),
    cycles_since_engine_overhaul:
      (aircraft.cycles_since_engine_overhaul ?? 0) + (operated ? 1 : 0),
  };
}

export function scheduleNextCheck(
  aircraft: AircraftAsset,
): MaintenanceSchedule {
  if ((aircraft.maintenance_next_d_check ?? Number.POSITIVE_INFINITY) <= 0) {
    return { check_type: "D_CHECK", due: true, remaining_turns: 0 };
  }

  if ((aircraft.maintenance_next_c_check ?? Number.POSITIVE_INFINITY) <= 0) {
    return { check_type: "C_CHECK", due: true, remaining_turns: 0 };
  }

  const remainingA =
    A_CHECK_DUE_HOURS - (aircraft.flight_hours_since_a_check ?? 0);

  if (remainingA <= 0) {
    return { check_type: "A_CHECK", due: true, remaining_hours: 0 };
  }

  const candidates: MaintenanceSchedule[] = [
    {
      check_type: "A_CHECK",
      due: false,
      remaining_hours: remainingA,
    },
  ];

  if (aircraft.maintenance_next_c_check !== undefined) {
    candidates.push({
      check_type: "C_CHECK",
      due: false,
      remaining_turns: aircraft.maintenance_next_c_check,
    });
  }

  return candidates[0] ?? { check_type: "NONE", due: false };
}

export function performACheck(aircraft: AircraftAsset): MaintenanceResult {
  const unit = deterministicUnit(`a-check:${aircraft.id}`);
  const minimumCost = isWideBody(aircraft) ? 65_000 : 20_000;
  const maximumCost = isWideBody(aircraft) ? 120_000 : 45_000;

  return {
    aircraft: {
      ...aircraft,
      flight_hours_since_a_check: 0,
      status: "AVAILABLE",
    },
    cost: Math.round(minimumCost + unit * (maximumCost - minimumCost)),
    duration_hours: 6 + unit * 4,
  };
}

export function performCCheck(aircraft: AircraftAsset): MaintenanceResult {
  const unit = deterministicUnit(`c-check:${aircraft.id}`);
  const variance = unit * 0.8 - 0.4;
  const baseCost = isWideBody(aircraft) ? 3_000_000 : 1_125_000;
  const cost = Math.min(
    4_500_000,
    Math.max(750_000, Math.round(baseCost * (1 + variance))),
  );

  return {
    aircraft: {
      ...aircraft,
      maintenance_next_c_check: 18 + Math.round(unit * 6),
      status: "AVAILABLE",
    },
    cost,
    duration_days: 10 + unit * 10,
  };
}

export function calculateMaintenanceReserve(aircraft: AircraftAsset): number {
  if (aircraft.acquisitionType !== "leased") {
    return 0;
  }

  return isWideBody(aircraft) ? 100_000 : 48_000;
}

export function calculateAogProbability(aircraft: AircraftAsset): number {
  let probability =
    AOG_BASE_PROBABILITY + Math.max(0, aircraft.ageYears - 10) * 0.003;

  if ((aircraft.condition ?? 100) < 80) {
    probability *= 1.5;
  }

  if ((aircraft.maintenance_next_c_check ?? 1) <= 0) {
    probability *= 2;
  }

  if (aircraft.utilizationHoursPerDay / 12 > 0.9) {
    probability *= 1.2;
  }

  return Math.min(1, probability);
}

export function rollAOGEvent(aircraft: AircraftAsset): AOGEvent | null {
  const risk = calculateAogProbability(aircraft);
  const roll = deterministicUnit(
    `aog:${aircraft.id}:${aircraft.ageYears}:${aircraft.condition ?? 100}:${aircraft.maintenance_next_c_check ?? 1}`,
  );

  if (roll >= risk) {
    return null;
  }

  const durationUnit = deterministicUnit(`aog-duration:${aircraft.id}`);

  return {
    id: `aog-${aircraft.id}`,
    aircraft_id: aircraft.id,
    duration_minutes: Math.round(60 + durationUnit * 60),
    aircraft_scale_factor: aircraftScaleFactor(aircraft),
    eu261_per_passenger: 250,
  };
}

export function calculateAOGCost(
  event: AOGEvent,
  affectedFlights: FlightLeg[],
): AOGCost {
  const passengers = affectedFlights.reduce(
    (total, flight) => total + (flight.passengers ?? 0),
    0,
  );
  const directCost =
    event.duration_minutes *
    AOG_COST_PER_MINUTE *
    event.aircraft_scale_factor;
  const eu261Cost = passengers * event.eu261_per_passenger;
  const brandScoreDamage = (event.duration_minutes / 60) * 0.5;

  return {
    direct_cost: directCost,
    eu261_cost: eu261Cost,
    brand_score_damage: brandScoreDamage,
    total_cost: directCost + eu261Cost,
  };
}
