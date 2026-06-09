import { describe, expect, it } from "vitest";

import { aircraftModelById } from "../data/indexes";
import { playableStateFixture } from "../test/fixtures";
import { advanceDays, advanceOneDay } from "./advance";

function expectFiniteNumbers(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(expectFiniteNumbers);
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach(expectFiniteNumbers);
  }
}

describe("daily and weekly turns", () => {
  it("advances exactly one calendar day and appends a daily report", () => {
    const state = playableStateFixture();
    const next = advanceOneDay(state);

    expect(next.currentDate).toBe("2027-03-19");
    expect(next.reports.daily).toHaveLength(state.reports.daily.length + 1);
    expect(next.reports.daily.at(-1)?.date).toBe("2027-03-18");
  });

  it("returns a new immutable state and appends route performance", () => {
    const state = playableStateFixture();
    const original = structuredClone(state);
    const next = advanceOneDay(state);

    expect(state).toEqual(original);
    expect(next).not.toBe(state);
    expect(next.routes[0]).not.toBe(state.routes[0]);
    expect(next.routes[0].performanceHistory).toHaveLength(1);
    expect(next.npcAirlines).not.toBe(state.npcAirlines);
  });

  it("simulates a scheduled round trip and reconciles report profit with cash", () => {
    const state = playableStateFixture();
    const next = advanceOneDay(state);
    const report = next.reports.daily.at(-1)!;
    const routeResult = report.routeResults[0];

    expect(routeResult.passengers).toBeGreaterThan(0);
    expect(routeResult.availableSeatKm).toBeGreaterThan(0);
    expect(routeResult.revenue).toBeGreaterThan(0);
    expect(routeResult.costs).toBeGreaterThan(0);
    expect(report.profit).toBeCloseTo(report.revenue - report.costs);
    expect(next.cash).toBeCloseTo(state.cash + report.profit);
    expectFiniteNumbers(report);
  });

  it("charges a leased aircraft once per day even when its route is not scheduled", () => {
    const state = playableStateFixture();
    state.routes[0] = {
      ...state.routes[0],
      operatingDays: [5],
      weeklyFrequency: 1,
    };
    const model = aircraftModelById.get(state.fleet[0].modelId)!;
    const next = advanceOneDay(state);
    const report = next.reports.daily.at(-1)!;

    expect(report.passengers).toBe(0);
    expect(report.revenue).toBe(0);
    expect(report.costs).toBeCloseTo(model.monthlyLease / 30);
    expect(report.routeResults[0].costs).toBe(0);
  });

  it("does not operate suspended routes but still records their daily result", () => {
    const state = playableStateFixture();
    state.routes[0] = { ...state.routes[0], status: "suspended" };
    const next = advanceOneDay(state);
    const result = next.reports.daily.at(-1)!.routeResults[0];

    expect(result.passengers).toBe(0);
    expect(result.revenue).toBe(0);
    expect(result.costs).toBe(0);
    expect(next.routes[0].performanceHistory).toEqual([result]);
  });

  it("advances a week by processing seven daily turns and adds a weekly report", () => {
    const state = playableStateFixture();
    const next = advanceDays(state, 7);

    expect(next.currentDate).toBe("2027-03-25");
    expect(next.reports.daily).toHaveLength(state.reports.daily.length + 7);
    expect(next.reports.weekly).toHaveLength(state.reports.weekly.length + 1);
    expect(next.reports.weekly.at(-1)).toMatchObject({
      startDate: "2027-03-18",
      endDate: "2027-03-24",
    });
  });

  it("closes a weekly report after seven individual daily turns", () => {
    const state = playableStateFixture();
    let next = state;

    for (let day = 0; day < 7; day += 1) {
      next = advanceOneDay(next);
    }

    const weekly = next.reports.weekly.at(-1)!;
    const dailyProfit = next.reports.daily.reduce(
      (total, report) => total + report.profit,
      0,
    );

    expect(next.reports.weekly).toHaveLength(1);
    expect(weekly.profit).toBeCloseTo(dailyProfit);
  });

  it("stops before processing a critical invalid state and records the reason", () => {
    const state = playableStateFixture();
    state.routes[0] = { ...state.routes[0], aircraftId: "missing-aircraft" };
    const next = advanceDays(state, 7);

    expect(next.currentDate).toBe(state.currentDate);
    expect(next.reports.daily).toHaveLength(0);
    expect(next.notifications.at(-1)).toMatchObject({ severity: "error" });
    expect(next.notifications.at(-1)?.message).toContain("0 of 7");
    expect(next.debug.errors.at(-1)).toContain("missing-aircraft");
  });

  it("rejects invalid route economics before they can create non-finite reports", () => {
    const state = playableStateFixture();
    state.routes[0] = {
      ...state.routes[0],
      economyPrice: Number.POSITIVE_INFINITY,
    };
    const next = advanceOneDay(state);

    expect(next.currentDate).toBe(state.currentDate);
    expect(next.reports.daily).toHaveLength(0);
    expect(next.debug.errors.at(-1)).toContain("invalid economics");
  });

  it("normalizes invalid requested day counts without advancing forever", () => {
    const state = playableStateFixture();

    expect(advanceDays(state, 0)).toEqual(state);
    expect(advanceDays(state, Number.POSITIVE_INFINITY)).toEqual(state);
  });
});
