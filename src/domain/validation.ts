import type {
  AircraftModel,
  Airport,
  City,
  Coordinates,
  NpcAirline,
} from "./types";

interface SeedData {
  airports: Airport[];
  cities: City[];
  aircraftModels: AircraftModel[];
  npcAirlines: NpcAirline[];
}

export interface ValidationResult {
  errors: string[];
}

const scoreFields = [
  "tourismScore",
  "businessScore",
  "diasporaScore",
] as const;

const airportScoreFields = [
  "congestionLevel",
  "hubPotentialScore",
  "touristGatewayScore",
  "businessGatewayScore",
] as const;

const aircraftPositiveFields = [
  "rangeKm",
  "economyCapacity",
  "businessCapacity",
  "bellyCargoKg",
  "fuelBurnKgPerHour",
  "purchasePrice",
  "monthlyLease",
  "maintenancePerHour",
  "crewPerHour",
  "cruiseSpeedKmh",
  "runwayRequirementM",
  "turnaroundMinutes",
] as const;

function reportDuplicates(
  values: string[],
  label: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function hasValidCoordinates(coordinates: Coordinates): boolean {
  return (
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lon) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lon >= -180 &&
    coordinates.lon <= 180
  );
}

function isUnitScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateSeeds({
  airports,
  cities,
  aircraftModels,
  npcAirlines,
}: SeedData): ValidationResult {
  const errors: string[] = [];
  const cityIds = new Set(cities.map((city) => city.id));
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const airportIds = new Set(airports.map((airport) => airport.id));
  const airportIatas = new Set(airports.map((airport) => airport.iata));
  const airportById = new Map(
    airports.map((airport) => [airport.id, airport]),
  );

  reportDuplicates(
    cities.map((city) => city.id),
    "city id",
    errors,
  );
  reportDuplicates(
    airports.map((airport) => airport.id),
    "airport id",
    errors,
  );
  reportDuplicates(
    airports.map((airport) => airport.iata),
    "airport IATA",
    errors,
  );
  reportDuplicates(
    aircraftModels.map((model) => model.id),
    "aircraft model id",
    errors,
  );
  reportDuplicates(
    npcAirlines.map((airline) => airline.id),
    "NPC airline id",
    errors,
  );

  for (const city of cities) {
    if (!hasValidCoordinates(city.coordinates)) {
      errors.push(`Invalid coordinates for city ${city.id}`);
    }
    for (const field of scoreFields) {
      if (!isUnitScore(city[field])) {
        errors.push(`Invalid score ${field} for city ${city.id}`);
      }
    }
    for (const airportId of city.nearbyAirportIds) {
      if (!airportIds.has(airportId)) {
        errors.push(`Missing nearby airport ${airportId} for city ${city.id}`);
      } else if (airportById.get(airportId)?.cityId !== city.id) {
        errors.push(
          `Nearby airport ${airportId} does not link back to city ${city.id}`,
        );
      }
    }
  }

  for (const airport of airports) {
    if (!cityIds.has(airport.cityId)) {
      errors.push(`Missing city ${airport.cityId} for airport ${airport.id}`);
    } else if (
      !cityById.get(airport.cityId)?.nearbyAirportIds.includes(airport.id)
    ) {
      errors.push(
        `Missing nearby link from city ${airport.cityId} to airport ${airport.id}`,
      );
    }
    if (!hasValidCoordinates(airport.coordinates)) {
      errors.push(`Invalid coordinates for airport ${airport.id}`);
    }
    for (const field of airportScoreFields) {
      if (!isUnitScore(airport[field])) {
        errors.push(`Invalid score ${field} for airport ${airport.id}`);
      }
    }
    const positiveFields = [
      airport.runwayLengthM,
      airport.slotCapacityPerDay,
      airport.terminalCapacityPerDay,
      airport.baseFees,
      airport.passengerFees,
    ];
    if (
      positiveFields.some(
        (value) => !Number.isFinite(value) || value <= 0,
      )
    ) {
      errors.push(`Invalid airport value for airport ${airport.id}`);
    }
  }

  for (const model of aircraftModels) {
    for (const field of aircraftPositiveFields) {
      if (!Number.isFinite(model[field]) || model[field] <= 0) {
        errors.push(`Invalid aircraft value ${field} for model ${model.id}`);
      }
    }
  }

  if (npcAirlines.length !== 8) {
    errors.push(`Expected 8 NPC airlines, received ${npcAirlines.length}`);
  }

  for (const airline of npcAirlines) {
    if (!airportIatas.has(airline.hubIata)) {
      errors.push(`Missing NPC hub ${airline.hubIata} for ${airline.id}`);
    }
    if (!isUnitScore(airline.reputation)) {
      errors.push(`Invalid NPC reputation for ${airline.id}`);
    }
    if (
      !Number.isFinite(airline.priceBias) ||
      airline.priceBias < 0.5 ||
      airline.priceBias > 1.5
    ) {
      errors.push(`Invalid NPC price bias for ${airline.id}`);
    }
    if (
      !Number.isFinite(airline.frequencyBias) ||
      airline.frequencyBias < 0.5 ||
      airline.frequencyBias > 1.5
    ) {
      errors.push(`Invalid NPC frequency bias for ${airline.id}`);
    }
  }

  return { errors };
}
