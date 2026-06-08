import { aircraftModels } from "./aircraftModels";
import { airports } from "./airports";
import { cities } from "./cities";

export const airportByIata = new Map(
  airports.map((airport) => [airport.iata, airport]),
);

export const cityById = new Map(cities.map((city) => [city.id, city]));

export const aircraftModelById = new Map(
  aircraftModels.map((model) => [model.id, model]),
);
