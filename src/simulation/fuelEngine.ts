// ============================================================
// TASK 4-B — Fuel Engine
// Consumo reale, prezzi per aeroporto, tankering, hedging
// Fonte: aerogrid_maintenance_fuel.md sez. 5-8
// Unità: kg (coerente con economics.ts DEFAULT_FUEL_PRICE_PER_KG)
// ============================================================

import type { AircraftModel } from "../domain/types";
import type { FuelHedge } from "../domain/types";

// ============================================================
// CONSUMO CARBURANTE REALE
// ============================================================

export interface FuelBurnInput {
  model: AircraftModel;
  distanceKm: number;
  windFactor: number;         // 0.92-1.08 (coda positiva, contraria negativa)
  loadFactor: number;         // 0-1
  aircraftAgeYears: number;   // degradazione motori +0.3%/anno
}

/**
 * Calcola il consumo totale in kg per un volo point-to-point.
 * Source: aerogrid_maintenance_fuel.md sez. 5
 */
export function calculateFuelBurn(input: FuelBurnInput): number {
  const { model, distanceKm, windFactor, loadFactor, aircraftAgeYears } = input;

  // Tempo di volo stimato (ore) — include discesa/salita (+15%)
  const cruiseTimeH = (distanceKm / model.cruiseSpeedKmh) * 1.15;

  // Consumo base da catalogo aereo (kg/ora)
  let burnKgH = model.fuelBurnKgPerHour;

  // Peso del carico: full LF aggiunge ~4% vs 70% LF
  const lfAdjustment = 1 + (loadFactor - 0.70) * 0.057;
  burnKgH *= lfAdjustment;

  // Degradazione motori: +0.3%/anno
  const ageDegradation = 1 + Math.min(aircraftAgeYears * 0.003, 0.12); // cap 12%
  burnKgH *= ageDegradation;

  // Wind factor (controvento aumenta consumo, favore lo riduce)
  burnKgH *= windFactor;

  // Combustibile per taxi (20 min a terra ~ 5% del totale volo medio)
  const taxiFuelKg = burnKgH * 0.05;

  const totalKg = burnKgH * cruiseTimeH + taxiFuelKg;

  // Riserve regolamentari: ICAO 5% contingency + 30min alternate + 30min final
  const reserveKg = totalKg * 0.10;

  return Math.round(totalKg + reserveKg);
}

// ============================================================
// PREZZO CARBURANTE PER AEROPORTO
// ============================================================

type AirportSize = "small" | "medium" | "large" | "megaHub";

/**
 * Restituisce il prezzo $/kg al dato aeroporto.
 * Hub del player: base market price
 * Aeroporto primario (large/megaHub): +5-15%
 * Aeroporto secondario (medium): +15-25%
 * Aeroporto remoto (small): +20-50%
 * Source: aerogrid_maintenance_fuel.md sez. 6
 */
export function getFuelPrice(
  airportSize: AirportSize,
  isPlayerHub: boolean,
  marketPricePerKg: number,
): number {
  if (isPlayerHub) return marketPricePerKg;

  const premium =
    airportSize === "megaHub" ? 0.08 :
    airportSize === "large"   ? 0.12 :
    airportSize === "medium"  ? 0.20 :
    0.35; // small

  return Math.round(marketPricePerKg * (1 + premium) * 10000) / 10000;
}

// ============================================================
// TANKERING DECISION
// ============================================================

export interface TankeringDecision {
  recommended: boolean;
  extraFuelKg: number;       // kg aggiuntivi da caricare
  savingPerFlight: number;   // $ risparmio netto
  constraintHit: boolean;    // true se MTOW/EU limit ha tagliato la quantità
  reason: string;
}

/**
 * Valuta se conviene fare tankering (caricare carburante extra alla partenza
 * perché la destinazione è più cara).
 * Limit EU ReFuelEU 2025: max 10% extra su rotte intra-EU.
 * Source: aerogrid_maintenance_fuel.md sez. 7, aerogrid_environmental_regulations.md
 */
export function evaluateTankering(opts: {
  distanceKm: number;
  model: AircraftModel;
  originPricePerKg: number;
  destPricePerKg: number;
  loadFactor: number;
  aircraftAgeYears: number;
  isIntraEU: boolean;
  mtowKg?: number;
  currentPayloadKg?: number;
}): TankeringDecision {
  const {
    distanceKm, model, originPricePerKg, destPricePerKg,
    loadFactor, aircraftAgeYears, isIntraEU,
  } = opts;

  const baseBurn = calculateFuelBurn({
    model, distanceKm,
    windFactor: 1.0,
    loadFactor,
    aircraftAgeYears,
  });

  // Quanto carburante serve per il ritorno (stima)
  const returnBurn = baseBurn * 0.95; // leggermente meno senza pax return

  const priceDiff = destPricePerKg - originPricePerKg;
  if (priceDiff <= 0) {
    return { recommended: false, extraFuelKg: 0, savingPerFlight: 0, constraintHit: false, reason: "Destinazione non è più cara" };
  }

  // Carburante extra ideale = tutto il return burn
  let extraKg = returnBurn;

  // Extra burn per portare il peso aggiuntivo (~2% per ogni 10% peso extra)
  const extraBurnFraction = extraKg / (baseBurn * 10) * 0.02;
  const extraBurnCost = extraKg * extraBurnFraction * originPricePerKg;

  let constraintHit = false;

  // Vincolo EU: max 10% extra su intra-EU
  if (isIntraEU) {
    const limit = baseBurn * 0.10;
    if (extraKg > limit) {
      extraKg = limit;
      constraintHit = true;
    }
  }

  // Vincolo MTOW (semplificato: se non specificato assumiamo 5% headroom)
  const mtow = opts.mtowKg ?? model.purchasePrice / 1000; // heuristic
  const currentPayload = opts.currentPayloadKg ?? loadFactor * 150 * 100; // ~100kg/pax
  const remainingMtow = mtow - currentPayload - baseBurn;
  if (extraKg > remainingMtow * 0.8) {
    extraKg = Math.max(0, remainingMtow * 0.8);
    constraintHit = true;
  }

  const savingGross = extraKg * priceDiff;
  const savingNet = savingGross - extraBurnCost;

  if (savingNet <= 0 || extraKg <= 0) {
    return { recommended: false, extraFuelKg: 0, savingPerFlight: 0, constraintHit, reason: "Risparmio netto negativo" };
  }

  return {
    recommended: true,
    extraFuelKg: Math.round(extraKg),
    savingPerFlight: Math.round(savingNet),
    constraintHit,
    reason: constraintHit
      ? `Risparmio $${Math.round(savingNet)} — limitato da ${isIntraEU ? "ReFuelEU 10%" : "MTOW"}`
      : `Risparmio netto $${Math.round(savingNet)} per volo`,
  };
}

// ============================================================
// HEDGING — payoff e suggerimento ottimale
// ============================================================

/**
 * Calcola il payoff giornaliero di uno strumento di hedging.
 * Identico all'implementazione in turnExtensions.ts ma qui è il canonical.
 * Source: aerogrid_maintenance_fuel.md sez. 8
 */
export function evaluateHedgePayoff(
  hedge: FuelHedge,
  actualPricePerKg: number,
  dailyCoveredKg: number,
): number {
  if (hedge.status !== "ACTIVE") return 0;

  switch (hedge.type) {
    case "CALL_OPTION":
      return actualPricePerKg > hedge.strikePrice
        ? (actualPricePerKg - hedge.strikePrice) * dailyCoveredKg - hedge.premiumPaid / 30
        : -hedge.premiumPaid / 30;

    case "COLLAR": {
      const floor = hedge.strikePrice * 0.85;
      if (actualPricePerKg > hedge.strikePrice)
        return (actualPricePerKg - hedge.strikePrice) * dailyCoveredKg;
      if (actualPricePerKg < floor)
        return (actualPricePerKg - floor) * dailyCoveredKg;
      return 0;
    }

    case "SWAP":
      return (actualPricePerKg - hedge.strikePrice) * dailyCoveredKg;
  }
}

export interface FuelForecast {
  currentPricePerKg: number;
  volatilityEstimate: number; // 0-1 (0.15 = 15% deviazione std annualizzata)
  trend: "RISING" | "FALLING" | "STABLE";
}

/**
 * Suggerisce lo strumento di hedging ottimale dato il mercato.
 * Source: aerogrid_maintenance_fuel.md sez. 8
 */
export function suggestOptimalHedge(
  forecast: FuelForecast,
  monthlyConsumptionKg: number,
  startDate: string,
): FuelHedge {
  const { currentPricePerKg, volatilityEstimate, trend } = forecast;

  // Rising + alta volatilità → CALL OPTION (protegge dal rialzo pagando premium)
  // Falling trend → COLLAR (beneficia dal ribasso, protegge dal rialzo)
  // Stable → SWAP (elimina volatilità, budget predictability)
  const type: FuelHedge["type"] =
    trend === "RISING" && volatilityEstimate > 0.20 ? "CALL_OPTION" :
    trend === "FALLING" ? "COLLAR" :
    "SWAP";

  const coveragePct = trend === "STABLE" ? 60 : 45;
  const durationMonths = type === "CALL_OPTION" ? 6 : type === "COLLAR" ? 9 : 12;

  // Premium call option = Black-Scholes semplificato: ~3-8% del valore nozionale
  const coveredKgMonth = monthlyConsumptionKg * coveragePct / 100;
  const notionalValue = coveredKgMonth * currentPricePerKg * durationMonths;
  const premiumPct = type === "CALL_OPTION" ? 0.05 + volatilityEstimate * 0.15 : 0;
  const premiumPaid = Math.round(notionalValue * premiumPct);

  return {
    type,
    coveragePct,
    durationMonths,
    strikePrice: Math.round(currentPricePerKg * (type === "COLLAR" ? 1.10 : 1.05) * 1000) / 1000,
    premiumPaid,
    monthlySaving: 0,  // calcolato ogni turno da evaluateHedgePayoff
    status: "ACTIVE",
    startDate,
  };
}
