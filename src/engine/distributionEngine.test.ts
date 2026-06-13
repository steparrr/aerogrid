import { describe, expect, it } from "vitest";

import type {
  DistributionChannel,
  PlayerAirline,
  Route,
} from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import {
  DISTRIBUTION_CHANNELS,
  calculateDistributionSummary,
  calculateNetRevenue,
  initiateNDCMigration,
  optimizeChannelMix,
  rebalanceChannelMix,
} from "./distributionEngine";

function airlineAtLevel(
  level: PlayerAirline["level"],
  channels: DistributionChannel[] = ["DIRECT"],
): PlayerAirline {
  const player = playableStateFixture().player;
  return {
    ...player,
    level,
    distribution: {
      channels,
      channel_mix: { DIRECT: 100 },
    },
  };
}

function revenueRoute(revenue: number): Route {
  return {
    ...playableStateFixture().routes[0],
    revenue_monthly: revenue,
  };
}

describe("distributionEngine", () => {
  it("uses the real channel costs, yield indexes and ancillary capture", () => {
    expect(DISTRIBUTION_CHANNELS).toMatchObject({
      DIRECT: { cost_pct: 2, yield_index: 100, ancillary_pct: 90, min_level: 1 },
      GDS: { cost_pct: 12, yield_index: 125, ancillary_pct: 40, min_level: 2 },
      OTA: { cost_pct: 18, yield_index: 85, ancillary_pct: 25, min_level: 1 },
      METASEARCH: { cost_pct: 5, yield_index: 95, ancillary_pct: 75, min_level: 2 },
      CORPORATE: { cost_pct: 8, yield_index: 140, ancillary_pct: 60, min_level: 3 },
      NDC: { cost_pct: 2, yield_index: 118, ancillary_pct: 85, min_level: 4 },
    });
  });

  it("calculates revenue after the channel commission", () => {
    expect(calculateNetRevenue(300, "DIRECT")).toBe(294);
    expect(calculateNetRevenue(375, "GDS")).toBe(330);
    expect(calculateNetRevenue(255, "OTA")).toBe(209.1);
  });

  it("recommends only unlocked channels and always totals 100 percent", () => {
    const recommendation = optimizeChannelMix(airlineAtLevel(2), [
      revenueRoute(1_000_000),
    ]);

    expect(Object.values(recommendation.mix).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(recommendation.mix.CORPORATE).toBeUndefined();
    expect(recommendation.mix.NDC).toBeUndefined();
    expect(recommendation.mix.METASEARCH).toBeGreaterThan(0);
  });

  it("uses NDC instead of legacy GDS in a level-four recommendation", () => {
    const recommendation = optimizeChannelMix(
      airlineAtLevel(4, ["DIRECT", "GDS"]),
      [revenueRoute(2_000_000)],
    );

    expect(recommendation.mix.NDC).toBeGreaterThan(0);
    expect(recommendation.mix.NDC).toBeGreaterThan(
      recommendation.mix.GDS ?? 0,
    );
  });

  it("rebalances editable channel allocation to exactly 100 percent", () => {
    const next = rebalanceChannelMix(
      { DIRECT: 60, GDS: 20, OTA: 20 },
      "DIRECT",
      80,
      ["DIRECT", "GDS", "OTA"],
    );

    expect(next).toEqual({ DIRECT: 80, GDS: 10, OTA: 10 });
    expect(Object.values(next).reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("calculates channel and network KPIs from monthly route revenue", () => {
    const airline = {
      ...airlineAtLevel(3, ["DIRECT", "GDS", "CORPORATE"]),
      core_kpis: {
        ...airlineAtLevel(3).core_kpis,
        ancillary_per_pax: 30,
      },
      distribution: {
        channels: ["DIRECT", "GDS", "CORPORATE"] as DistributionChannel[],
        channel_mix: { DIRECT: 50, GDS: 25, CORPORATE: 25 },
      },
    };

    const summary = calculateDistributionSummary(airline, [
      revenueRoute(1_000_000),
    ]);

    expect(summary.gross_revenue).toBe(1_000_000);
    expect(summary.channels.find((item) => item.channel === "DIRECT")).toMatchObject({
      traffic_pct: 50,
      ancillary_per_pax: 27,
    });
    expect(summary.distribution_cost_pct).toBeGreaterThan(0);
    expect(summary.net_revenue).toBeLessThan(summary.yield_adjusted_revenue);
  });

  it("creates the six-turn, $50M NDC migration plan with 80% GDS savings", () => {
    const plan = initiateNDCMigration(airlineAtLevel(4, ["DIRECT", "GDS"]));

    expect(plan).toMatchObject({
      eligible: true,
      implementation_cost: 50_000_000,
      duration_turns: 6,
      turns_remaining: 6,
      estimated_gds_cost_saving_pct: 80,
      status: "PLANNED",
    });
  });
});
