import { describe, expect, it } from "vitest";

import type { Aircraft, Route } from "../domain/types";
import { leased787Fixture, playableStateFixture } from "../test/fixtures";
import {
  buildDailyRotation,
  calculateDelayCost,
  calculateTurnaroundMinutes,
  calculateUtilization,
  checkFTLCompliance,
  getUtilizationAlert,
  propagateDelay,
  type DailyRotation,
} from "./rotationsEngine";

function narrowAircraft(): Aircraft {
  return {
    id: "a320-test",
    modelId: "airbus-a320neo",
    acquisitionType: "leased",
    ageYears: 1,
    reliability: 1,
    assignedRouteIds: ["route-fco-lhr"],
    utilizationHoursPerDay: 0,
  };
}

function narrowRoute(): Route {
  return {
    ...playableStateFixture().routes[0],
    id: "route-fco-lhr",
    destinationIata: "LHR",
    aircraftId: "a320-test",
    economySeats: 162,
    businessSeats: 18,
    economyPrice: 180,
    businessPrice: 620,
    pricing_strategy: "PRICE_LEADER",
  };
}

function rotationFixture(): DailyRotation {
  return {
    aircraft_id: "a320-test",
    date: { year: 2027, month: 3 },
    flights: [
      {
        id: "leg-1",
        route_id: "route-1",
        origin: "FCO",
        destination: "LHR",
        scheduled_departure_minute: 0,
        scheduled_arrival_minute: 120,
        actual_departure_minute: 0,
        actual_arrival_minute: 120,
        block_minutes: 120,
        turnaround_minutes: 30,
        delay_minutes: 0,
      },
      {
        id: "leg-2",
        route_id: "route-1",
        origin: "LHR",
        destination: "FCO",
        scheduled_departure_minute: 180,
        scheduled_arrival_minute: 300,
        actual_departure_minute: 180,
        actual_arrival_minute: 300,
        block_minutes: 120,
        turnaround_minutes: 30,
        delay_minutes: 0,
      },
    ],
    total_block_hours: 4,
    total_ground_time: 1,
    utilization_pct: 4 / 24,
    delay_minutes_accumulated: 0,
    ftl_compliant: true,
    target_block_hours: 12,
  };
}

describe("rotations engine", () => {
  it("builds an immutable outbound and return rotation for assigned routes", () => {
    const aircraft = leased787Fixture();
    const route = playableStateFixture().routes[0];
    const snapshot = structuredClone(route);

    const rotation = buildDailyRotation(aircraft, [route]);

    expect(route).toEqual(snapshot);
    expect(rotation.aircraft_id).toBe(aircraft.id);
    expect(rotation.flights).toHaveLength(2);
    expect(rotation.flights[0]).toMatchObject({
      origin: "FCO",
      destination: "JFK",
    });
    expect(rotation.flights[1]).toMatchObject({
      origin: "JFK",
      destination: "FCO",
    });
    expect(rotation.total_block_hours).toBeGreaterThan(0);
    expect(rotation.target_block_hours).toBe(16);
  });

  it("uses documented turnaround midpoints and base reduction", () => {
    const aircraft = narrowAircraft();
    const route = narrowRoute();

    expect(calculateTurnaroundMinutes(aircraft, route, true)).toBe(22.5);
    expect(calculateTurnaroundMinutes(aircraft, route, false)).toBe(32.5);
  });

  it("calculates block-hour utilization against the aircraft target", () => {
    const metrics = calculateUtilization(rotationFixture());

    expect(metrics.block_hours).toBe(4);
    expect(metrics.utilization_pct).toBeCloseTo(4 / 24);
    expect(metrics.target_achievement_pct).toBeCloseTo(4 / 12);
  });

  it("propagates only the unabsorbed delay to following flights", () => {
    const delayed = propagateDelay(rotationFixture(), 60, 0);

    expect(delayed.flights[0]?.delay_minutes).toBe(60);
    expect(delayed.flights[1]?.delay_minutes).toBe(30);
    expect(delayed.flights[1]?.actual_departure_minute).toBe(210);
    expect(delayed.delay_minutes_accumulated).toBe(90);
  });

  it("scales delay cost by aircraft size", () => {
    const narrow = calculateDelayCost(10, narrowAircraft());
    const wideLong = calculateDelayCost(10, leased787Fixture());

    expect(narrow).toBe(1_200);
    expect(wideLong).toBe(2_520);
  });

  it("checks both annual flight-time and daily duty FTL limits", () => {
    const compliant = checkFTLCompliance(rotationFixture(), {
      id: "crew-1",
      annual_flight_hours: 800,
      duty_hours_before_rotation: 1,
    });
    const nonCompliant = checkFTLCompliance(rotationFixture(), {
      id: "crew-2",
      annual_flight_hours: 899,
      duty_hours_before_rotation: 10,
    });

    expect(compliant.compliant).toBe(true);
    expect(nonCompliant).toMatchObject({
      compliant: false,
      annual_limit_exceeded: true,
      daily_duty_limit_exceeded: true,
    });
  });

  it("returns utilization alerts at documented thresholds", () => {
    const metrics = calculateUtilization(rotationFixture());

    expect(
      getUtilizationAlert({ ...metrics, target_achievement_pct: 0.91 }),
    ).toBe("OVERUTILIZATION");
    expect(
      getUtilizationAlert({ ...metrics, target_achievement_pct: 0.49 }),
    ).toBe("UNDERUTILIZATION");
    expect(
      getUtilizationAlert({ ...metrics, target_achievement_pct: 0.75 }),
    ).toBeNull();
  });
});
