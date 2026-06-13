import { describe, expect, it } from "vitest";

import type { Aircraft } from "../domain/types";
import { leased787Fixture } from "../test/fixtures";
import {
  calculateAogProbability,
  calculateAOGCost,
  calculateMaintenanceReserve,
  performACheck,
  performCCheck,
  rollAOGEvent,
  scheduleNextCheck,
  updateMaintenanceCounters,
} from "./maintenanceEngine";

function narrowAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    id: "a320-maintenance",
    modelId: "airbus-a320neo",
    acquisitionType: "leased",
    ageYears: 4,
    reliability: 0.95,
    assignedRouteIds: [],
    utilizationHoursPerDay: 8,
    condition: 90,
    maintenance_next_c_check: 12,
    maintenance_next_d_check: 72,
    flight_hours_since_a_check: 100,
    cycles_since_engine_overhaul: 20,
    maintenance_reserve_balance: 0,
    ...overrides,
  };
}

describe("maintenance engine", () => {
  it("updates maintenance counters immutably", () => {
    const aircraft = narrowAircraft();
    const snapshot = structuredClone(aircraft);

    const updated = updateMaintenanceCounters(aircraft, 25);

    expect(aircraft).toEqual(snapshot);
    expect(updated).toMatchObject({
      flight_hours_since_a_check: 125,
      maintenance_next_c_check: 11,
      maintenance_next_d_check: 71,
      cycles_since_engine_overhaul: 21,
    });
  });

  it("schedules the most urgent due check", () => {
    expect(
      scheduleNextCheck(
        narrowAircraft({
          flight_hours_since_a_check: 400,
          maintenance_next_c_check: 2,
        }),
      ),
    ).toMatchObject({ check_type: "A_CHECK", due: true });

    expect(
      scheduleNextCheck(narrowAircraft({ maintenance_next_d_check: 0 })),
    ).toMatchObject({ check_type: "D_CHECK", due: true });
  });

  it("performs deterministic A and C checks inside documented ranges", () => {
    const aircraft = narrowAircraft({ flight_hours_since_a_check: 500 });

    const aCheck = performACheck(aircraft);
    const cCheck = performCCheck(aircraft);

    expect(aCheck.aircraft.flight_hours_since_a_check).toBe(0);
    expect(aCheck.cost).toBeGreaterThanOrEqual(20_000);
    expect(aCheck.cost).toBeLessThanOrEqual(45_000);
    expect(aCheck.duration_hours).toBeGreaterThanOrEqual(6);
    expect(aCheck.duration_hours).toBeLessThanOrEqual(10);
    expect(cCheck.aircraft.maintenance_next_c_check).toBeGreaterThanOrEqual(18);
    expect(cCheck.aircraft.maintenance_next_c_check).toBeLessThanOrEqual(24);
    expect(cCheck.duration_days).toBeGreaterThanOrEqual(10);
    expect(cCheck.duration_days).toBeLessThanOrEqual(20);
  });

  it("calculates dry-lease maintenance reserves by aircraft size", () => {
    expect(calculateMaintenanceReserve(narrowAircraft())).toBe(48_000);
    expect(calculateMaintenanceReserve(leased787Fixture())).toBe(100_000);
    expect(
      calculateMaintenanceReserve(
        narrowAircraft({ acquisitionType: "owned" }),
      ),
    ).toBe(0);
  });

  it("raises AOG probability for documented risk factors", () => {
    const modern = narrowAircraft({
      ageYears: 5,
      condition: 90,
      utilizationHoursPerDay: 8,
      maintenance_next_c_check: 6,
    });
    const risky = narrowAircraft({
      ageYears: 15,
      condition: 60,
      utilizationHoursPerDay: 13,
      maintenance_next_c_check: 0,
    });

    expect(calculateAogProbability(risky)).toBeGreaterThan(
      calculateAogProbability(modern),
    );
    expect(rollAOGEvent(risky)).toEqual(rollAOGEvent(risky));
  });

  it("calculates AOG direct cost, passenger compensation, and brand damage", () => {
    const event = {
      id: "aog-test",
      aircraft_id: "a320-maintenance",
      duration_minutes: 240,
      aircraft_scale_factor: 1,
      eu261_per_passenger: 250,
    };
    const cost = calculateAOGCost(event, [
      {
        id: "leg-test",
        route_id: "route-test",
        origin: "FCO",
        destination: "LHR",
        scheduled_departure_minute: 0,
        scheduled_arrival_minute: 120,
        actual_departure_minute: 0,
        actual_arrival_minute: 120,
        block_minutes: 120,
        turnaround_minutes: 30,
        delay_minutes: 0,
        passengers: 100,
      },
    ]);

    expect(cost).toEqual({
      direct_cost: 28_800,
      eu261_cost: 25_000,
      brand_score_damage: 2,
      total_cost: 53_800,
    });
  });
});
