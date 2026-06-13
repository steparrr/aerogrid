import type {
  Airport,
  CompetitorAirline,
  GameState,
  Route,
} from "../domain/types";
import {
  calculateMarketShare,
  calculateSegmentDemand,
  type DemandSegment,
} from "../simulation/demandEngine";
import {
  getCompetitorResponse,
  type CompetitorAction,
} from "../simulation/competitorEngine";
import { generateDailyODDemand } from "../simulation/demand";
import {
  createRouteProposal,
  type RouteProposal,
} from "../simulation/routePlanner";

const MONTHS = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
] as const;
const WEEKS_PER_MONTH = 52 / 12;

// Documented in aerogrid_route_study.jsx as the standard new-route ramp.
const RAMP_POINTS = [
  { month: 1, factor: 0.58 },
  { month: 3, factor: 0.68 },
  { month: 6, factor: 0.74 },
  { month: 12, factor: 1 },
] as const;

const SEGMENT_LABELS: Record<DemandSegment, string> = {
  corporate: "Corporate",
  mice: "MICE",
  leisure: "Leisure",
  vfr: "VFR",
  student: "Student",
  transit: "Transit",
};

export interface RouteStudySegment {
  id: DemandSegment;
  label: string;
  passengers: number;
  share: number;
  elasticity: number;
  seasonalityFactor: number;
}

export interface RouteStudyCompetitor {
  id: string;
  name: string;
  archetype: string;
  frequencyIndex: number;
  economyPrice: number;
  businessPrice: number;
  marketShare: number;
  marketShareWithoutPlayer: number;
  response: CompetitorAction;
  history: Array<{ date: string; description: string }>;
}

export interface RouteStudyFinance {
  aircraft: string;
  weeklyFrequency: number;
  revenue: {
    economy: number;
    business: number;
    premium: number | null;
    ancillary: number;
    cargo: number;
    total: number;
  };
  costs: {
    fuel: number;
    lease: number;
    crew: number;
    handlingNavigation: number;
    airportFees: number;
    maintenance: number;
    total: number;
  };
  monthlyProfit: number;
  marginPercent: number;
  breakEvenLoadFactor: number;
  estimatedLoadFactor: number;
  ramp: Array<{
    month: number;
    revenue: number;
    profit: number;
    loadFactor: number;
  }>;
  npv24Months: number;
}

export type SlotRiskTone = "green" | "amber" | "red";

export interface RouteStudyResult {
  origin: Airport;
  destination: Airport;
  distanceKm: number;
  routeKey: string;
  reverseRouteKey: string;
  proposal: RouteProposal | null;
  market: {
    segments: RouteStudySegment[];
    totalPassengers: number;
    potentialPassengers: number;
    saturationPercent: number;
    seasonality: Array<{
      month: number;
      label: string;
      index: number;
      segmentFactors: Record<DemandSegment, number>;
    }>;
    drivers: Array<{ label: string; value: string }>;
  };
  competitors: RouteStudyCompetitor[];
  marketShare: {
    withPlayer: number;
    withoutPlayer: number;
  };
  finance: RouteStudyFinance | null;
  risks: {
    score: number;
    originSlot: { tone: SlotRiskTone; detail: string };
    destinationSlot: { tone: SlotRiskTone; detail: string };
    seasonalDropPercent: number;
    dominantCompetitor: string | null;
    etsApplicable: boolean;
    etsCost: number | null;
  };
  prerequisites: string[];
}

function round(value: number) {
  return Math.round(value);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function routeUses(
  competitor: CompetitorAirline,
  routeKey: string,
  reverseRouteKey: string,
) {
  const routes = [
    ...(competitor.active_routes ?? []),
    ...(competitor.activeRoutes ?? []),
  ];
  return routes.includes(routeKey) || routes.includes(reverseRouteKey);
}

function playerOwnsSlot(game: GameState, airport: Airport) {
  return game.player.slots.some(
    (slot) => (slot.airport_id ?? slot.airportIata) === airport.iata,
  );
}

function slotRisk(game: GameState, airport: Airport) {
  if (playerOwnsSlot(game, airport)) {
    return { tone: "green" as const, detail: "Slot gia presente nel portafoglio" };
  }
  if ((airport.slot_pool_available ?? 0) > 0) {
    return {
      tone: "green" as const,
      detail: `${airport.slot_pool_available} slot disponibili nel pool`,
    };
  }
  if (airport.slot_pool_available === 0) {
    return {
      tone: "red" as const,
      detail: airport.slot_market_price
        ? `Pool esaurito; mercato secondario ${formatMoney(airport.slot_market_price)}`
        : "Pool slot esaurito",
    };
  }
  return {
    tone: "amber" as const,
    detail: "Disponibilita pool non presente nel GameState",
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function routeForMarketShare(
  routeKey: string,
  proposal: RouteProposal,
): Route {
  return {
    ...proposal,
    id: `study-${routeKey}`,
    status: "active",
    performanceHistory: [],
  };
}

function historyFor(competitor: CompetitorAirline, routeKeys: string[]) {
  const priceHistory = (competitor.memory?.price_response_history ?? []).map(
    (entry) => ({
      date: entry.date,
      description: `Prezzo ${entry.pct >= 0 ? "-" : "+"}${Math.abs(round(entry.pct * 100))}% (${entry.trigger})`,
    }),
  );
  const routeHistory = (competitor.memory?.route_entry_history ?? [])
    .filter((entry) => routeKeys.includes(entry.routeKey))
    .map((entry) => ({
      date: entry.date,
      description:
        entry.eventType === "ENTER" ? "Ingresso sulla rotta" : "Uscita dalla rotta",
    }));

  return [...priceHistory, ...routeHistory]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 6);
}

function buildFinance(
  game: GameState,
  proposal: RouteProposal,
): RouteStudyFinance {
  const monthlyRevenue = proposal.forecast.revenue.total * WEEKS_PER_MONTH;
  const monthlyCosts = proposal.forecast.costs.total * WEEKS_PER_MONTH;
  const monthlyProfit = monthlyRevenue - monthlyCosts;
  const estimatedLoadFactor =
    proposal.forecast.availableSeatsPerFlight > 0
      ? proposal.forecast.expectedPassengersPerFlight /
        proposal.forecast.availableSeatsPerFlight
      : 0;
  const ramp = RAMP_POINTS.map(({ month, factor }) => ({
    month,
    revenue: money(monthlyRevenue * factor),
    profit: money(monthlyRevenue * factor - monthlyCosts),
    loadFactor: money(estimatedLoadFactor * factor * 100),
  }));
  const openingSlotCost = [proposal.originIata, proposal.destinationIata].reduce(
    (total, iata) => {
      const airport = game.airports[iata];
      return airport &&
        !playerOwnsSlot(game, airport) &&
        airport.slot_pool_available === 0
        ? total + (airport.slot_market_price ?? 0)
        : total;
    },
    0,
  );
  const npv24Months =
    Array.from({ length: 24 }, (_, index) => {
      const month = index + 1;
      const previous =
        [...RAMP_POINTS].reverse().find((point) => point.month <= month) ??
        RAMP_POINTS[0];
      return monthlyRevenue * previous.factor - monthlyCosts;
    }).reduce((total, profit) => total + profit, 0) - openingSlotCost;

  return {
    aircraft: proposal.aircraftId,
    weeklyFrequency: proposal.weeklyFrequency,
    revenue: {
      economy: money(proposal.forecast.revenue.economyTickets * WEEKS_PER_MONTH),
      business: money(
        proposal.forecast.revenue.businessTickets * WEEKS_PER_MONTH,
      ),
      premium: null,
      ancillary: money(proposal.forecast.revenue.ancillaries * WEEKS_PER_MONTH),
      cargo: money(proposal.forecast.revenue.bellyCargo * WEEKS_PER_MONTH),
      total: money(monthlyRevenue),
    },
    costs: {
      fuel: money(proposal.forecast.costs.fuel * WEEKS_PER_MONTH),
      lease: money(proposal.forecast.costs.lease * WEEKS_PER_MONTH),
      crew: money(proposal.forecast.costs.crew * WEEKS_PER_MONTH),
      handlingNavigation: money(
        proposal.forecast.costs.handlingNavigation * WEEKS_PER_MONTH,
      ),
      airportFees: money(
        proposal.forecast.costs.airportFees * WEEKS_PER_MONTH,
      ),
      maintenance: money(
        proposal.forecast.costs.maintenance * WEEKS_PER_MONTH,
      ),
      total: money(monthlyCosts),
    },
    monthlyProfit: money(monthlyProfit),
    marginPercent:
      monthlyRevenue > 0 ? money((monthlyProfit / monthlyRevenue) * 100) : 0,
    breakEvenLoadFactor: money(proposal.forecast.breakEvenLoadFactor * 100),
    estimatedLoadFactor: money(estimatedLoadFactor * 100),
    ramp,
    // Simplified NPV uses a 0% discount rate because no discount rate exists in GameState.
    npv24Months: money(npv24Months),
  };
}

export function buildRouteStudy(
  game: GameState,
  originIata: string,
  destinationIata: string,
): RouteStudyResult {
  const origin = game.airports[originIata];
  const destination = game.airports[destinationIata];

  if (!origin || !destination || origin.iata === destination.iata) {
    throw new Error("Route study requires two different known airports");
  }

  const routeKey = `${origin.iata}-${destination.iata}`;
  const reverseRouteKey = `${destination.iata}-${origin.iata}`;
  const date = game.currentDate;
  const demand = calculateSegmentDemand(date, origin, destination);
  const baseDemand = generateDailyODDemand(date, origin, destination);
  const segmentTotal = demand.segments.reduce(
    (total, segment) =>
      total + round(segment.basePassengers * segment.seasonalityFactor),
    0,
  );
  const segments = demand.segments.map((segment) => {
    const passengers = round(
      segment.basePassengers * segment.seasonalityFactor,
    );
    return {
      id: segment.segment,
      label: SEGMENT_LABELS[segment.segment],
      passengers,
      share: segmentTotal > 0 ? money((passengers / segmentTotal) * 100) : 0,
      elasticity: segment.elasticity,
      seasonalityFactor: segment.seasonalityFactor,
    };
  });
  const seasonality = MONTHS.map((label, index) => {
    const month = index + 1;
    const monthDemand = calculateSegmentDemand(
      `${game.game_date.year}-${String(month).padStart(2, "0")}-15`,
      origin,
      destination,
    );
    return {
      month,
      label,
      index:
        demand.totalMarket > 0
          ? money((monthDemand.totalMarket / demand.totalMarket) * 100)
          : 0,
      segmentFactors: Object.fromEntries(
        monthDemand.segments.map((segment) => [
          segment.segment,
          segment.seasonalityFactor,
        ]),
      ) as Record<DemandSegment, number>,
    };
  });
  let proposal: RouteProposal | null = null;

  try {
    proposal = createRouteProposal({
      originIata: origin.iata,
      destinationIata: destination.iata,
      fleet: game.fleet,
      date,
    });
  } catch {
    proposal = null;
  }

  const activeCompetitors = game.competitors.filter((competitor) =>
    routeUses(competitor, routeKey, reverseRouteKey),
  );
  const normalizedCompetitors = activeCompetitors.map((competitor) => ({
    ...competitor,
    activeRoutes: [routeKey],
  }));
  const share = proposal
    ? calculateMarketShare(
        routeForMarketShare(routeKey, proposal),
        normalizedCompetitors,
        game.reputation,
        demand.totalMarket,
      )
    : null;
  const shareWithoutPlayer = proposal
    ? calculateMarketShare(
        {
          ...routeForMarketShare(routeKey, proposal),
          weeklyFrequency: 0,
        },
        normalizedCompetitors,
        game.reputation,
        demand.totalMarket,
      )
    : null;
  const sharesById = new Map(
    share?.competitorShares.map((entry) => [entry.npcId, entry.share]) ?? [],
  );
  const sharesWithoutPlayerById = new Map(
    shareWithoutPlayer?.competitorShares.map((entry) => [
      entry.npcId,
      entry.share,
    ]) ?? [],
  );
  const competitors = activeCompetitors.map((competitor) => ({
    id: competitor.id,
    name: competitor.name,
    archetype: competitor.archetype ?? "LEGACY_WEAK",
    frequencyIndex: money(competitor.frequencyBias),
    economyPrice: money(baseDemand.expectedEconomyYield * competitor.priceBias),
    businessPrice: money(
      baseDemand.expectedBusinessYield * competitor.priceBias,
    ),
    marketShare: money((sharesById.get(competitor.id) ?? 0) * 100),
    marketShareWithoutPlayer: money(
      (sharesWithoutPlayerById.get(competitor.id) ?? 0) * 100,
    ),
    response: getCompetitorResponse(competitor, "PLAYER_OPENS_ROUTE", {
      type: "ROUTE_OPENED",
      routeKey,
      date,
    }),
    history: historyFor(competitor, [routeKey, reverseRouteKey]),
  }));
  const originSlot = slotRisk(game, origin);
  const destinationSlot = slotRisk(game, destination);
  const seasonalIndexes = seasonality.map((point) => point.index);
  const seasonalDropPercent =
    Math.max(...seasonalIndexes) > 0
      ? money(
          (1 - Math.min(...seasonalIndexes) / Math.max(...seasonalIndexes)) *
            100,
        )
      : 0;
  const dominantCompetitor =
    competitors.find((competitor) => competitor.archetype === "LEGACY_DOMINANT")
      ?.name ?? null;
  const etsApplicable =
    origin.continent === "Europe" && destination.continent === "Europe";
  const riskScore = clamp(
    (originSlot.tone === "red" ? 25 : originSlot.tone === "amber" ? 10 : 0) +
      (destinationSlot.tone === "red"
        ? 25
        : destinationSlot.tone === "amber"
          ? 10
          : 0) +
      (seasonalDropPercent >= 70 ? 25 : seasonalDropPercent >= 40 ? 12 : 0) +
      (dominantCompetitor ? 25 : 0) +
      (etsApplicable ? 10 : 0),
    0,
    100,
  );
  const prerequisites: string[] = [];

  if (!proposal) {
    prerequisites.push("Serve un aereo compatibile per questa distanza e pista");
  }
  for (const airport of [origin, destination]) {
    if (
      !playerOwnsSlot(game, airport) &&
      airport.slot_pool_available === 0
    ) {
      prerequisites.push(`Serve uno slot a ${airport.iata}`);
    }
  }

  return {
    origin,
    destination,
    distanceKm: demand.distanceKm,
    routeKey,
    reverseRouteKey,
    proposal,
    market: {
      segments,
      totalPassengers: segmentTotal,
      potentialPassengers: demand.segments.reduce(
        (total, segment) => total + segment.basePassengers,
        0,
      ),
      saturationPercent: 0,
      seasonality,
      drivers: [
        {
          label: "Turismo destinazione",
          value: `${round(destination.touristGatewayScore * 100)} / 100`,
        },
        {
          label: "Business gateway",
          value: `${round(
            ((origin.businessGatewayScore + destination.businessGatewayScore) /
              2) *
              100,
          )} / 100`,
        },
        {
          label: "Hub potential",
          value: `${round(
            Math.max(origin.hubPotentialScore, destination.hubPotentialScore) *
              100,
          )} / 100`,
        },
        {
          label: "Domanda student",
          value: `${segments.find((segment) => segment.id === "student")?.passengers ?? 0} pax/giorno`,
        },
      ],
    },
    competitors,
    marketShare: {
      withPlayer: money((share?.playerShare ?? 0) * 100),
      withoutPlayer: 0,
    },
    finance: proposal ? buildFinance(game, proposal) : null,
    risks: {
      score: riskScore,
      originSlot,
      destinationSlot,
      seasonalDropPercent,
      dominantCompetitor,
      etsApplicable,
      etsCost: null,
    },
    prerequisites,
  };
}
