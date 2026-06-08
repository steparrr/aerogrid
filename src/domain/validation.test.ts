import { describe, expect, it } from "vitest";
import { aircraftModels } from "../data/aircraftModels";
import { airports } from "../data/airports";
import { cities } from "../data/cities";
import {
  aircraftModelById,
  airportByIata,
  cityById,
} from "../data/indexes";
import { npcAirlines } from "../data/npcAirlines";
import { validateSeeds } from "./validation";

const requiredAirports = [
  "ATL",
  "JFK",
  "LAX",
  "ORD",
  "DFW",
  "LHR",
  "CDG",
  "FRA",
  "AMS",
  "MAD",
  "FCO",
  "DXB",
  "DOH",
  "AUH",
  "IST",
  "SIN",
  "HKG",
  "HND",
  "ICN",
  "BKK",
  "GRU",
  "EZE",
  "JNB",
  "ADD",
  "CAI",
  "SYD",
];

const requiredStartingHubs = ["FCO", "LHR", "JFK", "DXB", "SIN", "GRU"];

const requiredContinents = [
  "Europe",
  "North America",
  "South America",
  "Africa",
  "Middle East",
  "Asia",
  "Oceania",
];

const requiredAircraftModels = [
  "atr-72-600",
  "embraer-e175",
  "embraer-e190",
  "airbus-a220-300",
  "airbus-a320neo",
  "airbus-a321neo",
  "airbus-a330-900",
  "airbus-a350-900",
  "airbus-a380-800",
  "boeing-737-800",
  "boeing-737-max-8",
  "boeing-787-9",
  "boeing-777-300er",
  "boeing-767f",
  "boeing-777f",
];

describe("seed validation", () => {
  it("contains at least 40 valid airports and all required hubs", () => {
    const result = validateSeeds({
      airports,
      cities,
      aircraftModels,
      npcAirlines,
    });

    expect(result.errors).toEqual([]);
    expect(airports.length).toBeGreaterThanOrEqual(40);
    expect(airports.map((airport) => airport.iata)).toEqual(
      expect.arrayContaining([...requiredAirports, ...requiredStartingHubs]),
    );
    expect([...new Set(airports.map((airport) => airport.continent))]).toEqual(
      expect.arrayContaining(requiredContinents),
    );
  });

  it("contains the complete required aircraft catalog", () => {
    expect(aircraftModels.map((model) => model.id)).toEqual(
      expect.arrayContaining(requiredAircraftModels),
    );
  });

  it("contains exactly eight valid NPC airlines", () => {
    expect(npcAirlines).toHaveLength(8);
    expect(
      npcAirlines.every(
        (airline) =>
          airportByIata.has(airline.hubIata) &&
          airline.reputation >= 0 &&
          airline.reputation <= 1 &&
          airline.priceBias >= 0.5 &&
          airline.priceBias <= 1.5 &&
          airline.frequencyBias >= 0.5 &&
          airline.frequencyBias <= 1.5,
      ),
    ).toBe(true);
  });

  it("creates indexes for every airport, city, and aircraft model", () => {
    expect(airportByIata.size).toBe(airports.length);
    expect(cityById.size).toBe(cities.length);
    expect(aircraftModelById.size).toBe(aircraftModels.length);
  });

  it("reports invalid linked and numeric seed data", () => {
    const result = validateSeeds({
      cities: [
        ...cities.map((city, index) =>
          index === 1 ? { ...city, nearbyAirportIds: [] } : city,
        ),
        {
          ...cities[0],
          coordinates: { lat: 120, lon: 250 },
          nearbyAirportIds: ["missing-airport"],
          tourismScore: 2,
        },
      ],
      airports: [
        ...airports,
        {
          ...airports[0],
          cityId: "missing-city",
          hubPotentialScore: -1,
        },
      ],
      aircraftModels: [
        ...aircraftModels,
        {
          ...aircraftModels[0],
          rangeKm: 0,
        },
      ],
      npcAirlines: npcAirlines.slice(0, 7).map((airline, index) =>
        index === 0
          ? {
              ...airline,
              hubIata: "ZZZ",
              reputation: 2,
              priceBias: 0,
              frequencyBias: 2,
            }
          : airline,
      ),
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Duplicate city id"),
        expect.stringContaining("Duplicate airport id"),
        expect.stringContaining("Duplicate airport IATA"),
        expect.stringContaining("Duplicate aircraft model id"),
        expect.stringContaining("Missing city"),
        expect.stringContaining("Missing nearby airport"),
        expect.stringContaining("Missing nearby link"),
        expect.stringContaining("Invalid score"),
        expect.stringContaining("Invalid coordinates"),
        expect.stringContaining("Invalid aircraft value"),
        expect.stringContaining("Missing NPC hub"),
        expect.stringContaining("Invalid NPC reputation"),
        expect.stringContaining("Invalid NPC price bias"),
        expect.stringContaining("Invalid NPC frequency bias"),
        expect.stringContaining("Expected 8 NPC airlines"),
      ]),
    );
  });
});
