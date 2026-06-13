// ============================================================
// TASK 8-A — Carbon Engine (logica pura)
// CORSIA, EU ETS, SAF blending, Carbon Score A-F
// Fonte: aerogrid_environmental_regulations.md
// ============================================================

import type { Route } from "../domain/types";
import type { CarbonRating, CarbonScore } from "../domain/types";

// ============================================================
// CORSIA (2024+)
// Offset obbligatorio 15.95% delle emissioni internazionali
// ============================================================

const CORSIA_OFFSET_FRACTION = 0.1595;   // 15.95%
const CO2_KG_PER_KG_FUEL     = 3.16;     // fattore emissione Jet A-1

/**
 * Calcola il costo mensile CORSIA.
 * offsetPricePerTon: $1-20/tCO₂ (variabile ogni turno per mercato volontario)
 * Source: aerogrid_environmental_regulations.md sez. CORSIA
 */
export function calculateCORSIACost(
  monthlyFuelKg: number,
  intraEeaFraction: number,    // 0-1 (es. 0.40 se 40% voli intra-EEA)
  offsetPricePerTon: number,   // $/tCO₂
): number {
  const internationalFuelKg = monthlyFuelKg * (1 - intraEeaFraction);
  const co2Tonnes = (internationalFuelKg * CO2_KG_PER_KG_FUEL) / 1000;
  const offsetTonnes = co2Tonnes * CORSIA_OFFSET_FRACTION;
  return Math.round(offsetTonnes * offsetPricePerTon);
}

// ============================================================
// EU ETS (2026+)
// 100% auctioneering intra-EEA
// ============================================================

/**
 * Calcola il costo mensile EU ETS solo per rotte intra-EEA.
 * Scale-in: 25%→50%→100% pagato (2024→2025→2026).
 * Source: aerogrid_environmental_regulations.md sez. ETS
 */
export function calculateETSCost(
  routes: Route[],
  monthlyFuelKgPerRoute: Map<string, number>,
  etsPriceEUR: number,   // €60-120/tCO₂
  gameYear: number,
): number {
  // Aeroporti in area EEA (28 EU + Islanda + Norvegia + Liechtenstein)
  const eea = new Set(["FCO", "LHR", "CDG", "AMS", "FRA", "MAD", "BCN", "VIE", "ZRH", "MXP",
    "LIS", "CPH", "ARN", "HEL", "WAW", "PRG", "BRU", "ATH", "DUB", "OSL", "KEF"]);

  const shareByYear = gameYear <= 2024 ? 0.25 : gameYear <= 2025 ? 0.50 : 1.00;

  let totalCost = 0;
  for (const route of routes) {
    if (route.status !== "active") continue;
    const isIntraEea = eea.has(route.originIata) && eea.has(route.destinationIata);
    if (!isIntraEea) continue;

    const fuelKg = monthlyFuelKgPerRoute.get(route.id) ?? 0;
    const co2Tonnes = (fuelKg * CO2_KG_PER_KG_FUEL) / 1000;
    totalCost += co2Tonnes * etsPriceEUR * shareByYear;
  }

  return Math.round(totalCost);
}

// ============================================================
// SAF BLENDING (ReFuelEU)
// ============================================================

const SAF_MANDATES: Array<{ year: number; pct: number; costMultiplier: number }> = [
  { year: 2025, pct: 0.02, costMultiplier: 3.0 },
  { year: 2030, pct: 0.06, costMultiplier: 2.5 },
  { year: 2035, pct: 0.20, costMultiplier: 2.0 },
  { year: 2040, pct: 0.34, costMultiplier: 1.7 },
  { year: 2050, pct: 0.70, costMultiplier: 1.4 },
];

export interface SAFCost {
  mandatePct: number;
  safKgRequired: number;
  premiumCost: number;         // $ costo extra vs Jet A-1 convenzionale
  penaltyIfNonCompliant: number; // $ multa se non si raggiunge il mandate
}

/**
 * Calcola il costo SAF mensile.
 * Source: aerogrid_environmental_regulations.md sez. ReFuelEU
 */
export function calculateSAFCost(
  monthlyFuelKg: number,
  fuelPricePerKg: number,
  gameYear: number,
): SAFCost {
  const mandate = [...SAF_MANDATES].reverse().find(m => gameYear >= m.year)
    ?? { year: 2024, pct: 0, costMultiplier: 1 };

  const safKgRequired = monthlyFuelKg * mandate.pct;
  const premiumPerKg  = fuelPricePerKg * (mandate.costMultiplier - 1);
  const premiumCost   = Math.round(safKgRequired * premiumPerKg);

  // Multa non-compliance: €100/GJ non coperto (ca. €1.50/kg non coperto)
  const penaltyPerKg = 1.50;
  const penaltyIfNonCompliant = Math.round(safKgRequired * penaltyPerKg);

  return {
    mandatePct: mandate.pct,
    safKgRequired: Math.round(safKgRequired),
    premiumCost,
    penaltyIfNonCompliant,
  };
}

// ============================================================
// CARBON SCORE A-F
// ============================================================

// Benchmark industria: 0.090 kg CO₂/pax-km (IATA 2023)
const INDUSTRY_BENCHMARK_CO2_PER_PAX_KM = 0.090;

/**
 * Calcola il Carbon Score (A-F) basato su emissioni/pax-km vs benchmark.
 * Source: aerogrid_environmental_regulations.md sez. Carbon Score
 */
export function calculateCarbonScore(opts: {
  monthlyFuelKg: number;
  monthlyPax: number;
  avgRouteKm: number;
  safBlendPct: number;
  corsiaMonthly: number;
  etsMonthly: number;
  safPremiumMonthly: number;
  fuelPricePerKg: number;
  gameYear: number;
}): CarbonScore {
  const { monthlyFuelKg, monthlyPax, avgRouteKm, safBlendPct } = opts;

  // Emissioni nette: SAF riduce CO₂ del 70% per la quota blended
  const safReductionFactor = 1 - safBlendPct * 0.70;
  const netCo2Kg = monthlyFuelKg * CO2_KG_PER_KG_FUEL * safReductionFactor;
  const paxKm = monthlyPax * avgRouteKm;
  const emissionsPerPaxKm = paxKm > 0 ? netCo2Kg / paxKm : INDUSTRY_BENCHMARK_CO2_PER_PAX_KM;

  const ratio = emissionsPerPaxKm / INDUSTRY_BENCHMARK_CO2_PER_PAX_KM;
  const rating: CarbonRating =
    ratio < 0.75 ? "A" :
    ratio < 0.90 ? "B" :
    ratio < 1.05 ? "C" :
    ratio < 1.20 ? "D" :
    "F";

  const totalComplianceCostMonthly =
    opts.corsiaMonthly + opts.etsMonthly + opts.safPremiumMonthly;

  return {
    rating,
    emissionsPerPaxKm: Math.round(emissionsPerPaxKm * 100000) / 100000,
    industryBenchmark: INDUSTRY_BENCHMARK_CO2_PER_PAX_KM,
    corsiaMonthly: opts.corsiaMonthly,
    etsMonthly: opts.etsMonthly,
    safBlendPct,
    totalComplianceCostMonthly,
  };
}

// ============================================================
// IMPATTO NPS E LOAN COST
// ============================================================

export interface NPSImpact {
  corporateLoadFactorDelta: number;  // variazione load factor segmento corporate
  loanCostDelta: number;             // variazione % costo debito (es. 0.02 = +2%)
  euRouteBan: boolean;               // true se rating F → possibile ban rotte EU
  description: string;
}

/**
 * Calcola l'impatto del carbon score su NPS, costi del debito, accesso rotte.
 * Source: aerogrid_environmental_regulations.md sez. effetti
 */
export function getCarbonNPSImpact(score: CarbonScore): NPSImpact {
  switch (score.rating) {
    case "A":
      return {
        corporateLoadFactorDelta: +0.03,
        loanCostDelta: -0.04,   // -4% sui prestiti (ESG premium)
        euRouteBan: false,
        description: "Rating A: +3% load factor corporate, -4% costo prestiti ESG",
      };
    case "B":
      return {
        corporateLoadFactorDelta: 0,
        loanCostDelta: 0,
        euRouteBan: false,
        description: "Rating B: neutro",
      };
    case "C":
      return {
        corporateLoadFactorDelta: -0.05,
        loanCostDelta: +0.02,
        euRouteBan: false,
        description: "Rating C: -5% load factor corporate, +2% costi prestiti",
      };
    case "D":
      return {
        corporateLoadFactorDelta: -0.10,
        loanCostDelta: +0.05,
        euRouteBan: false,
        description: "Rating D: -10% load factor corporate, +5% costi prestiti",
      };
    case "F":
      return {
        corporateLoadFactorDelta: -0.18,
        loanCostDelta: +0.10,
        euRouteBan: true,
        description: "Rating F: -18% load factor corporate, +10% costi prestiti, rischio ban rotte EU",
      };
  }
}

// ============================================================
// RACCOMANDAZIONI AUTOMATICHE
// ============================================================

export interface CarbonRecommendation {
  priority: "HIGH" | "MEDIUM" | "LOW";
  action: string;
  expectedSaving: number;   // $/mese
}

/**
 * Genera raccomandazioni per migliorare il carbon score.
 */
export function generateCarbonRecommendations(
  score: CarbonScore,
  monthlyFuelKg: number,
  routes: Route[],
  routeFuelMap: Map<string, number>,
): CarbonRecommendation[] {
  const recs: CarbonRecommendation[] = [];

  if (score.rating === "F" || score.rating === "D") {
    recs.push({
      priority: "HIGH",
      action: "Aumenta SAF blend al livello mandato — evita multa non-compliance",
      expectedSaving: score.corsiaMonthly * 0.20,
    });
  }

  // Identifica rotta più emissiva
  let worstRoute: Route | null = null;
  let worstFuel = 0;
  for (const route of routes) {
    const fuel = routeFuelMap.get(route.id) ?? 0;
    if (fuel > worstFuel) { worstFuel = fuel; worstRoute = route; }
  }
  if (worstRoute && worstFuel > monthlyFuelKg * 0.20) {
    recs.push({
      priority: "MEDIUM",
      action: `Rotta ${worstRoute.originIata}→${worstRoute.destinationIata} contribuisce ${Math.round(worstFuel / monthlyFuelKg * 100)}% emissioni — considera SAF o carbon offset`,
      expectedSaving: Math.round(worstFuel * 0.15 * 0.05),
    });
  }

  if (score.rating !== "A" && score.rating !== "B") {
    recs.push({
      priority: "LOW",
      action: "Fleet upgrade: sostituire aerei >15 anni con modelli di nuova generazione riduce consumo 15-20%",
      expectedSaving: Math.round(monthlyFuelKg * 0.17 * 0.90),
    });
  }

  return recs;
}
