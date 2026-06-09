import { cityById } from "../data/indexes";
import type { Airport, DemandEstimate } from "../domain/types";
import { calculateDistanceKm } from "./geography";

const MONTH_FACTORS = [
  0.86, 0.88, 0.94, 1, 1.05, 1.12, 1.18, 1.14, 1.04, 0.98, 0.9, 1.08,
];
const EQUATORIAL_BAND_DEGREES = 15;
const EQUATORIAL_AMPLITUDE = 0.35;

const ZERO_DEMAND: DemandEstimate = {
  business: 0,
  leisure: 0,
  vfr: 0,
  total: 0,
  expectedEconomyYield: 0,
  expectedBusinessYield: 0,
  seasonality: 1,
};

function parseMonth(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new RangeError("Date must use YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("Date must be a valid calendar date");
  }

  return month;
}

function distanceBandFactor(distanceKm: number) {
  if (distanceKm <= 750) return 1.15;
  if (distanceKm <= 2_000) return 1;
  if (distanceKm <= 5_000) return 0.72;
  if (distanceKm <= 9_000) return 0.48;
  return 0.3;
}

function average(first: number, second: number) {
  return (first + second) / 2;
}

function geometricScale(first: number, second: number, divisor: number) {
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    first < 0 ||
    second < 0
  ) {
    return 0;
  }

  return (Math.sqrt(first) * Math.sqrt(second)) / divisor;
}

function destinationSeasonality(month: number, latitude: number) {
  const monthIndex = month - 1;
  const seasonalMonthIndex =
    latitude < -EQUATORIAL_BAND_DEGREES ? (monthIndex + 6) % 12 : monthIndex;
  const factor = MONTH_FACTORS[seasonalMonthIndex];
  const amplitude =
    Math.abs(latitude) < EQUATORIAL_BAND_DEGREES ? EQUATORIAL_AMPLITUDE : 1;

  return 1 + (factor - 1) * amplitude;
}

function toPassengerCount(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

export function generateDailyODDemand(
  date: string,
  originAirport: Airport,
  destinationAirport: Airport,
): DemandEstimate {
  const month = parseMonth(date);

  if (originAirport.id === destinationAirport.id) {
    return { ...ZERO_DEMAND };
  }

  const originCity = cityById.get(originAirport.cityId);
  const destinationCity = cityById.get(destinationAirport.cityId);

  if (!originCity || !destinationCity) {
    throw new Error("Demand requires airports linked to known cities");
  }

  const distanceKm = calculateDistanceKm(
    originAirport.coordinates,
    destinationAirport.coordinates,
  );
  const distanceFactor = distanceBandFactor(distanceKm);
  const seasonality = destinationSeasonality(
    month,
    destinationCity.coordinates.lat,
  );
  const populationScale = geometricScale(
    originCity.population,
    destinationCity.population,
    1_000_000,
  );
  const wealthScale = geometricScale(
    originCity.gdpPerCapita,
    destinationCity.gdpPerCapita,
    50_000,
  );

  const business = toPassengerCount(
    populationScale *
      wealthScale *
      average(originCity.businessScore, destinationCity.businessScore) *
      average(
        originAirport.businessGatewayScore,
        destinationAirport.businessGatewayScore,
      ) *
      distanceFactor *
      18 *
      (0.92 + seasonality * 0.08),
  );
  const leisure = toPassengerCount(
    populationScale *
      average(originCity.tourismScore, destinationCity.tourismScore) *
      average(
        originAirport.touristGatewayScore,
        destinationAirport.touristGatewayScore,
      ) *
      distanceFactor *
      35 *
      seasonality,
  );
  const vfr = toPassengerCount(
    populationScale *
      average(originCity.diasporaScore, destinationCity.diasporaScore) *
      average(
        originAirport.hubPotentialScore,
        destinationAirport.hubPotentialScore,
      ) *
      distanceFactor *
      24 *
      (0.8 + seasonality * 0.2),
  );
  const expectedEconomyYield = Math.max(
    0,
    Math.round((45 + distanceKm * 0.105) * 100) / 100,
  );
  const expectedBusinessYield = Math.max(
    0,
    Math.round(expectedEconomyYield * 2.8 * 100) / 100,
  );

  return {
    business,
    leisure,
    vfr,
    total: business + leisure + vfr,
    expectedEconomyYield,
    expectedBusinessYield,
    seasonality,
  };
}
