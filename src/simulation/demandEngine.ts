// ============================================================
// TASK 5-A — Demand Engine (6 segmenti)
// Estende generateDailyODDemand di demand.ts con elasticità reali,
// market share, hub premium, network effect, transit demand.
// Fonte: aerogrid_route_formation_report.md, aerogrid_hub_vs_p2p.md
// ============================================================

import type { Airport, NpcAirline, Route } from "../domain/types";
import type { NpcAirlineExtended } from "../domain/types";
import { generateDailyODDemand } from "./demand";
import { calculateDistanceKm } from "./geography";
import { cityById } from "../data/indexes";

// ============================================================
// 6 SEGMENTI CON ELASTICITÀ REALI
// Fonte: aerogrid_route_formation_report.md
// ============================================================

export type DemandSegment = "corporate" | "leisure" | "vfr" | "mice" | "student" | "transit";

export const SEGMENT_ELASTICITY: Record<DemandSegment, number> = {
  corporate: 0.37,   // quasi inelastico, prenota 7-14gg prima
  leisure:   1.89,   // molto elastico, prenota 45-120gg prima
  vfr:       2.10,   // Visiting Friends & Relatives, stagionale
  mice:      1.20,   // Meetings/Incentives/Conferences/Events
  student:   1.60,   // picchi settembre/gennaio/giugno
  transit:   0.80,   // solo con hub wave structure attiva
};

// Stagionalità mensile per segmento (moltiplicatori, indice 0=gen)
const SEASONALITY: Record<DemandSegment, number[]> = {
  corporate: [1.05, 1.10, 1.10, 1.05, 1.05, 0.85, 0.70, 0.75, 1.10, 1.10, 1.05, 0.65],
  leisure:   [0.72, 0.75, 0.88, 1.00, 1.10, 1.20, 1.35, 1.30, 1.00, 0.90, 0.80, 1.05],
  vfr:       [0.85, 0.82, 0.88, 0.90, 0.95, 1.10, 1.25, 1.20, 0.95, 0.90, 0.85, 1.15],
  mice:      [0.85, 0.95, 1.10, 1.15, 1.20, 0.90, 0.70, 0.80, 1.20, 1.15, 1.10, 0.70],
  student:   [1.20, 0.80, 0.85, 0.90, 0.90, 1.20, 0.85, 0.80, 1.30, 0.90, 0.85, 0.75],
  transit:   [0.90, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.15, 1.05, 1.00, 0.95, 0.95],
};

// Qual è il lead time di prenotazione (giorni medi) per segmento
export const BOOKING_LEAD_DAYS: Record<DemandSegment, number> = {
  corporate: 11,
  leisure:   82,
  vfr:       55,
  mice:      45,
  student:   30,
  transit:   3,
};

// ============================================================
// DOMANDA PER SEGMENTO
// ============================================================

export interface SegmentDemand {
  segment: DemandSegment;
  basePassengers: number;    // domanda di mercato totale (tutti i carrier)
  seasonalityFactor: number;
  elasticity: number;
}

export interface FullODDemand {
  segments: SegmentDemand[];
  totalMarket: number;
  distanceKm: number;
  isLongHaul: boolean;
}

/**
 * Calcola la domanda totale per O/D per segmento in un turno.
 * Estende generateDailyODDemand aggiungendo mice, student, transit.
 */
export function calculateSegmentDemand(
  date: string,
  origin: Airport,
  destination: Airport,
): FullODDemand {
  const base = generateDailyODDemand(date, origin, destination);
  const month = parseInt(date.slice(5, 7), 10);
  const monthIdx = month - 1;

  const distanceKm = calculateDistanceKm(origin.coordinates, destination.coordinates);

  const originCity = cityById.get(origin.cityId);
  const destCity   = cityById.get(destination.cityId);
  const uniScore   = ((originCity?.businessScore ?? 0.5) + (destCity?.businessScore ?? 0.5)) / 2;

  // MICE: proporzionale al business score degli aeroporti
  const miceBase = Math.round(
    base.business * 0.22 *
    ((origin.businessGatewayScore + destination.businessGatewayScore) / 2)
  );

  // STUDENT: proporzionale alla popolazione, picco autunno/inverno
  const studentBase = Math.round(
    base.vfr * 0.30 * uniScore
  );

  // TRANSIT: basato sul hub potential score degli aeroporti (dipende da wave structure)
  const transitBase = Math.round(
    base.total * 0.08 *
    Math.max(origin.hubPotentialScore, destination.hubPotentialScore)
  );

  const segments: SegmentDemand[] = [
    { segment: "corporate", basePassengers: base.business, seasonalityFactor: SEASONALITY.corporate[monthIdx]!, elasticity: SEGMENT_ELASTICITY.corporate },
    { segment: "leisure",   basePassengers: base.leisure,  seasonalityFactor: SEASONALITY.leisure[monthIdx]!,   elasticity: SEGMENT_ELASTICITY.leisure   },
    { segment: "vfr",       basePassengers: base.vfr,      seasonalityFactor: SEASONALITY.vfr[monthIdx]!,       elasticity: SEGMENT_ELASTICITY.vfr       },
    { segment: "mice",      basePassengers: miceBase,       seasonalityFactor: SEASONALITY.mice[monthIdx]!,      elasticity: SEGMENT_ELASTICITY.mice      },
    { segment: "student",   basePassengers: studentBase,    seasonalityFactor: SEASONALITY.student[monthIdx]!,   elasticity: SEGMENT_ELASTICITY.student   },
    { segment: "transit",   basePassengers: transitBase,    seasonalityFactor: SEASONALITY.transit[monthIdx]!,   elasticity: SEGMENT_ELASTICITY.transit   },
  ];

  const totalMarket = segments.reduce((s, seg) => s + Math.round(seg.basePassengers * seg.seasonalityFactor), 0);

  return { segments, totalMarket, distanceKm, isLongHaul: distanceKm > 4500 };
}

// ============================================================
// MARKET SHARE
// ============================================================

export interface MarketShare {
  playerShare: number;       // 0-1
  competitorShares: Array<{ npcId: string; share: number }>;
  remainingUncaptured: number;
}

/**
 * Calcola la quota di mercato del player su quella rotta vs competitor.
 * Considera frequenza, prezzo, brand (reputation).
 */
export function calculateMarketShare(
  playerRoute: Route,
  competitors: (NpcAirline | NpcAirlineExtended)[],
  playerReputation: number,
  totalMarketPax: number,
): MarketShare {
  // Calcola "attractiveness" relativa con formula logit semplice
  function attractiveness(frequency: number, priceBias: number, reputation: number): number {
    return frequency * (1 / priceBias) * (0.7 + reputation * 0.6);
  }

  const playerFreq = playerRoute.weeklyFrequency;
  const playerPriceBias = playerRoute.economyPrice / 200; // normalizzato vs $200 base
  const playerAttr = attractiveness(playerFreq, playerPriceBias, playerReputation);

  // Solo competitor che operano su questa rotta (approssimato con frequencyBias)
  const routeKey = `${playerRoute.originIata}-${playerRoute.destinationIata}`;
  const activeCompetitors = competitors.filter(c => {
    const ext = c as NpcAirlineExtended;
    return ext.activeRoutes?.includes(routeKey) || ext.frequencyBias > 0.9;
  }).slice(0, 4); // max 4 competitor su una rotta

  const competitorAttrs = activeCompetitors.map(c => ({
    npcId: c.id,
    attr: attractiveness(
      3 * c.frequencyBias,       // frequenza NPC normalizzata
      c.priceBias,
      c.reputation / 100,
    ),
  }));

  const totalAttr = playerAttr + competitorAttrs.reduce((s, c) => s + c.attr, 0);

  const playerShare = totalAttr > 0 ? playerAttr / totalAttr : 0;
  const competitorShares = competitorAttrs.map(c => ({
    npcId: c.npcId,
    share: totalAttr > 0 ? c.attr / totalAttr : 0,
  }));

  return {
    playerShare: Math.round(playerShare * 1000) / 1000,
    competitorShares,
    remainingUncaptured: Math.max(0, Math.round(totalMarketPax * (1 - playerShare - competitorShares.reduce((s, c) => s + c.share, 0)))),
  };
}

// ============================================================
// HUB DOMINANCE PRICING PREMIUM
// ============================================================

/**
 * Restituisce il moltiplicatore di pricing premium per hub dominance.
 * >30% share: +8% pricing power (hub premium)
 * >65% share (fortress): +25% pricing power
 * Source: aerogrid_hub_vs_p2p.md
 */
export function getHubPricingPremium(hubDominancePct: number): number {
  if (hubDominancePct >= 0.65) return 1.25;
  if (hubDominancePct >= 0.30) return 1.08;
  return 1.00;
}

// ============================================================
// NETWORK EFFECT
// ============================================================

/**
 * Calcola il moltiplicatore di valore aggiuntivo di un nuovo spoke.
 * N spoke → N×(N-1) O/D potenziali; ogni nuovo spoke vale di più.
 * Source: aerogrid_hub_vs_p2p.md
 */
export function calculateNetworkEffect(currentSpokes: number, newSpokeAdded: boolean): number {
  if (!newSpokeAdded || currentSpokes === 0) return 1.0;

  // Metcalfe-like: valore cresce come N*(N-1)
  const before = currentSpokes * (currentSpokes - 1);
  const after  = (currentSpokes + 1) * currentSpokes;
  const ratio  = before > 0 ? after / before : 2;

  // Limita a max 1.35x per spoke singolo (diminishing returns)
  return Math.min(1.35, Math.round(ratio * 100) / 100);
}

// ============================================================
// TRANSIT DEMAND (hub wave structure)
// ============================================================

export interface WaveStructure {
  active: boolean;
  waveCount: number;         // 1-4 wave giornalieri
  hubIata: string;
}

/**
 * Calcola la domanda di transito attraverso l'hub.
 * Solo con wave structure attiva.
 * Source: aerogrid_hub_vs_p2p.md
 */
export function calculateTransitDemand(
  hubAirport: Airport,
  wave: WaveStructure,
  totalHubDemand: number,
): number {
  if (!wave.active) return 0;

  // Ogni wave aggiuntiva aggiunge ~15% di transito catturabile
  const waveFactor = 1 + (wave.waveCount - 1) * 0.15;
  const hubScore   = hubAirport.hubPotentialScore;

  return Math.round(totalHubDemand * 0.12 * hubScore * waveFactor);
}

// ============================================================
// ELASTICITÀ: effetto variazione prezzo su domanda
// ============================================================

/**
 * Applica l'elasticità di un segmento a una variazione di prezzo.
 * pricePct: variazione % del prezzo (es. 0.10 = +10%)
 * Restituisce il moltiplicatore sulla domanda (es. 0.81 = -19% pax)
 */
export function applyElasticity(
  segment: DemandSegment,
  pricePctChange: number,
): number {
  const elasticity = SEGMENT_ELASTICITY[segment];
  const demandChange = -elasticity * pricePctChange;
  return Math.max(0.10, 1 + demandChange);
}
