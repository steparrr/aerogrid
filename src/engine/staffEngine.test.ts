import { describe, expect, it } from "vitest";

import type { Aircraft, StaffMetrics } from "../domain/types";
import {
  calculatePilotRequirement,
  calculateStrikeRisk,
  getPilotCost,
  updateUnionMorale,
} from "./staffEngine";

function aircraft(
  id: string,
  modelId: string,
  utilizationHoursPerDay: number,
): Aircraft {
  return {
    id,
    modelId,
    acquisitionType: "leased",
    ageYears: 2,
    reliability: 0.98,
    assignedRouteIds: [],
    utilizationHoursPerDay,
  };
}

describe("staff engine", () => {
  it("calculates pilot requirements from FTL hours and augmented long-haul crews", () => {
    const requirement = calculatePilotRequirement([
      aircraft("a320", "airbus-a320neo", 12),
      aircraft("a350", "airbus-a350-900", 14),
    ]);

    expect(requirement).toEqual({
      total: 37,
      narrow_body: 11,
      wide_body: 0,
      wide_lh: 26,
      by_aircraft: {
        a320: 11,
        a350: 26,
      },
    });
  });

  it("returns documented annual pilot costs by aircraft type and seniority", () => {
    expect(getPilotCost("NARROW", "JUNIOR")).toBe(75_000);
    expect(getPilotCost("NARROW", "SENIOR")).toBe(180_000);
    expect(getPilotCost("WIDE", "JUNIOR")).toBe(150_000);
    expect(getPilotCost("WIDE", "SENIOR")).toBe(280_000);
    expect(getPilotCost("WIDE_LH", "SENIOR")).toBe(390_000);
  });

  it("updates union morale immutably using documented HR action effects", () => {
    const staff: StaffMetrics = {
      union_morale: 50,
      unionMorale: 50,
      union_contract_expires_turn: 18,
    };
    const snapshot = structuredClone(staff);

    const improved = updateUnionMorale(staff, [
      { type: "SALARY_RAISE" },
      { type: "BENEFITS_IMPROVED" },
      { type: "COMMUNICATION_CAMPAIGN" },
    ]);

    expect(staff).toEqual(snapshot);
    expect(improved.union_morale).toBe(73);
    expect(improved.unionMorale).toBe(73);
    expect(improved.strike_risk).toBeLessThan(
      calculateStrikeRisk(staff),
    );
  });

  it("clamps morale and applies documented inaction decay", () => {
    expect(
      updateUnionMorale(
        { union_morale: 1, union_contract_expires_turn: 24 },
        [{ type: "IGNORE" }],
      ).union_morale,
    ).toBe(0);

    expect(
      updateUnionMorale(
        { union_morale: 95, union_contract_expires_turn: 24 },
        [{ type: "SALARY_RAISE" }],
      ).union_morale,
    ).toBe(100);
  });

  it("lowers morale for salary freezes, excessive utilization, and imminent expiry", () => {
    const result = updateUnionMorale(
      { union_morale: 70, union_contract_expires_turn: 3 },
      [
        { type: "SALARY_FREEZE" },
        { type: "HIGH_UTILIZATION" },
        { type: "CONTRACT_EXPIRING" },
      ],
    );

    expect(result.union_morale).toBeLessThan(70);
    expect(result.strike_risk).toBeGreaterThan(50);
  });

  it("raises strike risk as morale falls and contract expiry approaches", () => {
    const stable = calculateStrikeRisk({
      union_morale: 80,
      union_contract_expires_turn: 24,
      strike_risk: 0,
    });
    const critical = calculateStrikeRisk({
      union_morale: 35,
      union_contract_expires_turn: 3,
      strike_risk: 0.1,
    });

    expect(stable).toBeLessThan(10);
    expect(critical).toBeGreaterThan(50);
  });

  it("accepts camelCase metrics without compounding stored strike risk", () => {
    const baseline = calculateStrikeRisk({
      unionMorale: 50,
      unionContractExpiresDate: "2026-09-01",
    });

    expect(
      calculateStrikeRisk({
        unionMorale: 50,
        unionContractExpiresDate: "2026-09-01",
        strikeRisk: 0.82,
      }),
    ).toBe(baseline);
  });
});
