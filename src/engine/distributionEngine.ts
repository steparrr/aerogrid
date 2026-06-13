import type {
  DistributionChannel,
  PlayerAirline,
  Route,
} from "../domain/types";

export interface DistributionChannelDefinition {
  label: string;
  cost_pct: number;
  yield_index: number;
  ancillary_pct: number;
  min_level: PlayerAirline["level"];
  monthly_infrastructure_cost: number;
  passenger_type: string;
  data_ownership: boolean;
}

export const DISTRIBUTION_CHANNELS: Record<
  DistributionChannel,
  DistributionChannelDefinition
> = {
  DIRECT: {
    label: "Diretto",
    cost_pct: 2,
    yield_index: 100,
    ancillary_pct: 90,
    min_level: 1,
    monthly_infrastructure_cost: 5_000,
    passenger_type: "Loyalist e leisure direct",
    data_ownership: true,
  },
  GDS: {
    label: "GDS + Agenzia",
    cost_pct: 12,
    yield_index: 125,
    ancillary_pct: 40,
    min_level: 2,
    monthly_infrastructure_cost: 15_000,
    passenger_type: "Corporate e TMC",
    data_ownership: false,
  },
  OTA: {
    label: "OTA",
    cost_pct: 18,
    yield_index: 85,
    ancillary_pct: 25,
    min_level: 1,
    monthly_infrastructure_cost: 0,
    passenger_type: "Leisure sensibile al prezzo",
    data_ownership: false,
  },
  METASEARCH: {
    label: "Metasearch",
    cost_pct: 5,
    yield_index: 95,
    ancillary_pct: 75,
    min_level: 2,
    monthly_infrastructure_cost: 8_000,
    passenger_type: "Comparatore attento",
    data_ownership: true,
  },
  CORPORATE: {
    label: "Corporate / TMC",
    cost_pct: 8,
    yield_index: 140,
    ancillary_pct: 60,
    min_level: 3,
    monthly_infrastructure_cost: 50_000,
    passenger_type: "Corporate ad alto valore",
    data_ownership: false,
  },
  NDC: {
    label: "NDC",
    cost_pct: 2,
    yield_index: 118,
    ancillary_pct: 85,
    min_level: 4,
    monthly_infrastructure_cost: 0,
    passenger_type: "Agenzie e TMC con contenuto ricco",
    data_ownership: true,
  },
};

export const DISTRIBUTION_CHANNEL_ORDER: DistributionChannel[] = [
  "DIRECT",
  "GDS",
  "OTA",
  "METASEARCH",
  "CORPORATE",
  "NDC",
];

export type ChannelMix = Partial<Record<DistributionChannel, number>>;

export interface ChannelMixRecommendation {
  mix: ChannelMix;
  estimated_distribution_cost_pct: number;
  estimated_net_yield_index: number;
  reason: string;
}

export interface ChannelDistributionMetrics {
  channel: DistributionChannel;
  traffic_pct: number;
  gross_revenue: number;
  yield_adjusted_revenue: number;
  net_revenue: number;
  distribution_cost: number;
  ancillary_per_pax: number;
}

export interface DistributionSummary {
  gross_revenue: number;
  yield_adjusted_revenue: number;
  net_revenue: number;
  distribution_cost: number;
  distribution_cost_pct: number;
  ancillary_per_pax: number;
  channels: ChannelDistributionMetrics[];
}

export interface NDCMigrationPlan {
  eligible: boolean;
  implementation_cost: number;
  duration_turns: number;
  turns_remaining: number;
  estimated_gds_cost_saving_pct: number;
  estimated_monthly_saving: number;
  status: "BLOCKED" | "PLANNED" | "IN_PROGRESS" | "COMPLETE";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sumMix(mix: ChannelMix) {
  return Object.values(mix).reduce((sum, value) => sum + (value ?? 0), 0);
}

function routeBusinessShare(routes: Route[]) {
  const seats = routes.reduce(
    (totals, route) => ({
      business: totals.business + route.businessSeats,
      total: totals.total + route.businessSeats + route.economySeats,
    }),
    { business: 0, total: 0 },
  );
  return seats.total > 0 ? seats.business / seats.total : 0.12;
}

function normalizedIntegerMix(
  scores: Array<{ channel: DistributionChannel; score: number }>,
): ChannelMix {
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  const allocations = scores.map((item) => {
    const exact = total > 0 ? (item.score / total) * 100 : 0;
    return { ...item, exact, value: Math.floor(exact) };
  });
  let remaining = 100 - allocations.reduce((sum, item) => sum + item.value, 0);

  allocations
    .sort((a, b) => b.exact - b.value - (a.exact - a.value))
    .forEach((item) => {
      if (remaining > 0) {
        item.value += 1;
        remaining -= 1;
      }
    });

  return Object.fromEntries(
    allocations.map(({ channel, value }) => [channel, value]),
  ) as ChannelMix;
}

function distributionMix(airline: PlayerAirline, routes: Route[]) {
  const stored =
    airline.distribution.channel_mix ?? airline.distribution.channelMix;
  if (stored && Math.round(sumMix(stored)) === 100) {
    return stored;
  }
  return optimizeChannelMix(airline, routes).mix;
}

function monthlyRouteRevenue(routes: Route[]) {
  return routes.reduce((sum, route) => {
    if (route.status !== "active") return sum;
    if (route.revenue_monthly !== undefined) return sum + route.revenue_monthly;
    return sum + (route.performanceHistory.at(-1)?.revenue ?? 0);
  }, 0);
}

export function calculateNetRevenue(
  grossRevenue: number,
  channel: DistributionChannel,
): number {
  const costRate = DISTRIBUTION_CHANNELS[channel].cost_pct / 100;
  return roundMoney(Math.max(0, grossRevenue) * (1 - costRate));
}

export function optimizeChannelMix(
  airline: PlayerAirline,
  routes: Route[],
): ChannelMixRecommendation {
  const businessShare = routeBusinessShare(routes);
  const needsVisibility = routes.length < 6;
  const ndcUnlocked = airline.level >= DISTRIBUTION_CHANNELS.NDC.min_level;

  const scores = DISTRIBUTION_CHANNEL_ORDER.filter(
    (channel) => airline.level >= DISTRIBUTION_CHANNELS[channel].min_level,
  ).map((channel) => {
    const definition = DISTRIBUTION_CHANNELS[channel];
    const netYield = definition.yield_index * (1 - definition.cost_pct / 100);
    const multiplier: Record<DistributionChannel, number> = {
      DIRECT: 1.15 + (needsVisibility ? 0.12 : 0),
      GDS: (0.65 + businessShare * 2) * (ndcUnlocked ? 0.22 : 1),
      OTA: 0.35 + (1 - businessShare) * 0.35,
      METASEARCH: 0.8 + (needsVisibility ? 0.25 : 0),
      CORPORATE: 0.35 + businessShare * 3,
      NDC: 1 + businessShare * 2,
    };
    return { channel, score: netYield * multiplier[channel] };
  });

  const mix = normalizedIntegerMix(scores);
  const estimated = calculateDistributionSummary(airline, routes, mix);

  return {
    mix,
    estimated_distribution_cost_pct: estimated.distribution_cost_pct,
    estimated_net_yield_index:
      estimated.gross_revenue > 0
        ? roundMoney(
            (estimated.net_revenue / estimated.gross_revenue) * 100,
          )
        : roundMoney(
            scores.reduce(
              (sum, item) =>
                sum +
                (mix[item.channel] ?? 0) *
                  DISTRIBUTION_CHANNELS[item.channel].yield_index *
                  (1 - DISTRIBUTION_CHANNELS[item.channel].cost_pct / 100),
              0,
            ) / 100,
          ),
    reason: ndcUnlocked
      ? "NDC sostituisce gran parte del GDS legacy, mantenendo accesso corporate con costi inferiori."
      : needsVisibility
        ? "Diretto e metasearch sostengono la crescita; i canali premium aumentano con il livello."
        : "Mix bilanciato tra controllo diretto, visibilità e yield corporate.",
  };
}

export function rebalanceChannelMix(
  currentMix: ChannelMix,
  changedChannel: DistributionChannel,
  requestedValue: number,
  editableChannels: DistributionChannel[],
): ChannelMix {
  const nextValue = Math.max(0, Math.min(100, Math.round(requestedValue)));
  const others = editableChannels.filter((channel) => channel !== changedChannel);
  const remaining = 100 - nextValue;
  const previousOthersTotal = others.reduce(
    (sum, channel) => sum + (currentMix[channel] ?? 0),
    0,
  );
  const scores = others.map((channel) => ({
    channel,
    score:
      previousOthersTotal > 0
        ? (currentMix[channel] ?? 0) / previousOthersTotal
        : 1,
  }));
  const otherMix = normalizedIntegerMix(scores);
  const scaledOthers = normalizedIntegerMix(
    scores.map((item) => ({
      ...item,
      score: (otherMix[item.channel] ?? 0) * remaining,
    })),
  );

  if (remaining === 0) {
    return Object.fromEntries(
      editableChannels.map((channel) => [
        channel,
        channel === changedChannel ? nextValue : 0,
      ]),
    ) as ChannelMix;
  }

  const result: ChannelMix = { [changedChannel]: nextValue };
  let assigned = 0;
  others.forEach((channel, index) => {
    const value =
      index === others.length - 1
        ? remaining - assigned
        : Math.round(((scaledOthers[channel] ?? 0) / 100) * remaining);
    result[channel] = value;
    assigned += value;
  });
  return result;
}

export function calculateDistributionSummary(
  airline: PlayerAirline,
  routes: Route[],
  mix = distributionMix(airline, routes),
): DistributionSummary {
  const grossRevenue = monthlyRouteRevenue(routes);
  const ancillaryBase = airline.core_kpis.ancillary_per_pax;
  const channels = DISTRIBUTION_CHANNEL_ORDER.filter(
    (channel) => (mix[channel] ?? 0) > 0,
  ).map((channel): ChannelDistributionMetrics => {
    const definition = DISTRIBUTION_CHANNELS[channel];
    const trafficPct = mix[channel] ?? 0;
    const channelBaseRevenue = grossRevenue * (trafficPct / 100);
    const yieldAdjustedRevenue =
      channelBaseRevenue * (definition.yield_index / 100);
    const afterCommission = calculateNetRevenue(yieldAdjustedRevenue, channel);
    const infrastructureCost = definition.monthly_infrastructure_cost;
    const netRevenue = Math.max(0, afterCommission - infrastructureCost);

    return {
      channel,
      traffic_pct: trafficPct,
      gross_revenue: roundMoney(channelBaseRevenue),
      yield_adjusted_revenue: roundMoney(yieldAdjustedRevenue),
      net_revenue: roundMoney(netRevenue),
      distribution_cost: roundMoney(
        yieldAdjustedRevenue - netRevenue,
      ),
      ancillary_per_pax: roundMoney(
        ancillaryBase * (definition.ancillary_pct / 100),
      ),
    };
  });

  const totals = channels.reduce(
    (sum, channel) => ({
      yield: sum.yield + channel.yield_adjusted_revenue,
      net: sum.net + channel.net_revenue,
      cost: sum.cost + channel.distribution_cost,
      ancillary:
        sum.ancillary +
        channel.ancillary_per_pax * (channel.traffic_pct / 100),
    }),
    { yield: 0, net: 0, cost: 0, ancillary: 0 },
  );

  return {
    gross_revenue: roundMoney(grossRevenue),
    yield_adjusted_revenue: roundMoney(totals.yield),
    net_revenue: roundMoney(totals.net),
    distribution_cost: roundMoney(totals.cost),
    distribution_cost_pct:
      totals.yield > 0 ? roundMoney((totals.cost / totals.yield) * 100) : 0,
    ancillary_per_pax: roundMoney(totals.ancillary),
    channels,
  };
}

export function initiateNDCMigration(
  airline: PlayerAirline,
): NDCMigrationPlan {
  const turnsRemaining =
    airline.distribution.ndc_migration_turns_remaining ?? 6;
  const ndcActive = airline.distribution.channels.includes("NDC");
  const eligible =
    airline.level >= DISTRIBUTION_CHANNELS.NDC.min_level &&
    airline.distribution.channels.includes("GDS") &&
    !ndcActive;
  const gdsRevenue =
    monthlyRouteRevenue(airline.routes) *
    ((airline.distribution.channel_mix?.GDS ??
      airline.distribution.channelMix?.GDS ??
      0) /
      100);

  return {
    eligible,
    implementation_cost: 50_000_000,
    duration_turns: 6,
    turns_remaining: ndcActive ? 0 : Math.max(0, Math.min(6, turnsRemaining)),
    estimated_gds_cost_saving_pct: 80,
    estimated_monthly_saving: roundMoney(
      gdsRevenue * (DISTRIBUTION_CHANNELS.GDS.cost_pct / 100) * 0.8,
    ),
    status: ndcActive
      ? "COMPLETE"
      : turnsRemaining < 6
        ? "IN_PROGRESS"
        : eligible
          ? "PLANNED"
          : "BLOCKED",
  };
}
