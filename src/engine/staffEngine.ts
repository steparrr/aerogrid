import { aircraftModelById } from "../data/indexes";
import type { AircraftAsset, StaffMetrics } from "../domain/types";

const MAX_ANNUAL_FLIGHT_HOURS = 900;
const STAFFING_BUFFER = 1.15;
const LONG_HAUL_RANGE_KM = 8_000;
const WIDE_BODY_SEATS = 250;

export type PilotType = "NARROW" | "WIDE" | "WIDE_LH";
export type PilotSeniority = "JUNIOR" | "SENIOR";

export interface PilotRequirement {
  total: number;
  narrow_body: number;
  wide_body: number;
  wide_lh: number;
  by_aircraft: Record<string, number>;
}

export type HRAction =
  | { type: "SALARY_RAISE" }
  | { type: "SALARY_FREEZE" }
  | { type: "SALARY_ADVANCE" }
  | { type: "PROFIT_SHARING_BONUS" }
  | { type: "BENEFITS_IMPROVED" }
  | { type: "WORK_CONDITION_IMPROVE" }
  | { type: "COMMUNICATION_CAMPAIGN" }
  | { type: "FLEXIBLE_SCHEDULING" }
  | { type: "NEW_ROUTES" }
  | { type: "HIGH_UTILIZATION" }
  | { type: "CONTRACT_EXPIRING" }
  | { type: "IGNORE" };

const PILOT_COSTS: Record<PilotType, Record<PilotSeniority, number>> = {
  NARROW: { JUNIOR: 75_000, SENIOR: 180_000 },
  WIDE: { JUNIOR: 150_000, SENIOR: 280_000 },
  WIDE_LH: { JUNIOR: 150_000, SENIOR: 390_000 },
};

const MORALE_EFFECTS: Record<HRAction["type"], number> = {
  SALARY_RAISE: 15,
  SALARY_FREEZE: -5,
  SALARY_ADVANCE: 5,
  PROFIT_SHARING_BONUS: 8,
  BENEFITS_IMPROVED: 5,
  WORK_CONDITION_IMPROVE: 5,
  COMMUNICATION_CAMPAIGN: 3,
  FLEXIBLE_SCHEDULING: 4,
  NEW_ROUTES: 3,
  HIGH_UTILIZATION: -4,
  CONTRACT_EXPIRING: -3,
  IGNORE: -2,
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pilotTypeForAircraft(aircraft: AircraftAsset): PilotType | null {
  const model = aircraftModelById.get(aircraft.modelId);

  if (!model) {
    return null;
  }

  if (model.rangeKm > LONG_HAUL_RANGE_KM) {
    return "WIDE_LH";
  }

  return model.economyCapacity + model.businessCapacity >= WIDE_BODY_SEATS
    ? "WIDE"
    : "NARROW";
}

function pilotsForAircraft(aircraft: AircraftAsset, type: PilotType) {
  const crewPerFlight = type === "WIDE_LH" ? 4 : 2;
  const annualBlockHours = Math.max(0, aircraft.utilizationHoursPerDay) * 365;

  return Math.round(
    (annualBlockHours * crewPerFlight * STAFFING_BUFFER) /
      MAX_ANNUAL_FLIGHT_HOURS,
  );
}

function moraleOf(staff: StaffMetrics) {
  return clamp(staff.union_morale ?? staff.unionMorale ?? 50);
}

function contractTurnsOf(staff: StaffMetrics) {
  if (staff.union_contract_expires_turn !== undefined) {
    return staff.union_contract_expires_turn;
  }

  return staff.unionContractExpiresDate ? 12 : 24;
}

export function calculatePilotRequirement(
  fleet: AircraftAsset[],
): PilotRequirement {
  const requirement: PilotRequirement = {
    total: 0,
    narrow_body: 0,
    wide_body: 0,
    wide_lh: 0,
    by_aircraft: {},
  };

  for (const aircraft of fleet) {
    const type = pilotTypeForAircraft(aircraft);

    if (!type) {
      continue;
    }

    const pilots = pilotsForAircraft(aircraft, type);
    const bucket =
      type === "NARROW"
        ? "narrow_body"
        : type === "WIDE"
          ? "wide_body"
          : "wide_lh";

    requirement.by_aircraft[aircraft.id] = pilots;
    requirement[bucket] += pilots;
    requirement.total += pilots;
  }

  return requirement;
}

export function getPilotCost(
  type: PilotType,
  seniority: PilotSeniority,
): number {
  return PILOT_COSTS[type][seniority];
}

export function calculateStrikeRisk(staff: StaffMetrics): number {
  const moraleRisk = Math.max(0, 70 - moraleOf(staff)) * 1.2;
  const turnsRemaining = contractTurnsOf(staff);
  const expiryRisk =
    turnsRemaining <= 0
      ? 40
      : turnsRemaining <= 3
        ? 40
        : turnsRemaining <= 6
          ? 20
          : turnsRemaining <= 12
            ? 10
            : 0;

  return Math.round(clamp(moraleRisk + expiryRisk));
}

export function updateUnionMorale(
  staff: StaffMetrics,
  actions: HRAction[],
): StaffMetrics {
  const delta = actions.reduce(
    (total, action) => total + MORALE_EFFECTS[action.type],
    0,
  );
  const morale = clamp(moraleOf(staff) + delta);
  const nextForRisk: StaffMetrics = {
    ...staff,
    union_morale: morale,
    unionMorale: morale,
    strike_risk: undefined,
    strikeRisk: undefined,
  };
  const strikeRisk = calculateStrikeRisk(nextForRisk);

  return {
    ...staff,
    union_morale: morale,
    unionMorale: morale,
    strike_risk: strikeRisk,
    strikeRisk: strikeRisk / 100,
  };
}
