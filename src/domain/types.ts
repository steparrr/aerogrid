export type Continent =
  | "Europe"
  | "North America"
  | "South America"
  | "Africa"
  | "Middle East"
  | "Asia"
  | "Oceania";

export type AirportSize = "small" | "medium" | "large" | "megaHub";
export type AircraftRole = "passenger" | "freighter";
export type AcquisitionType = "owned" | "leased";
export type RouteStatus = "active" | "suspended";
export type GameView =
  | "operations"
  | "market"
  | "airports"
  | "planner"
  | "routes"
  | "fleet"
  | "finance"
  | "contracts"
  | "debug";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface City {
  id: string;
  name: string;
  country: string;
  continent: Continent;
  population: number;
  gdpPerCapita: number;
  tourismScore: number;
  businessScore: number;
  diasporaScore: number;
  coordinates: Coordinates;
  nearbyAirportIds: string[];
}

export interface Airport {
  id: string;
  iata: string;
  icao: string;
  name: string;
  cityId: string;
  country: string;
  continent: Continent;
  coordinates: Coordinates;
  airportSize: AirportSize;
  runwayLengthM: number;
  slotCapacityPerDay: number;
  terminalCapacityPerDay: number;
  baseFees: number;
  passengerFees: number;
  congestionLevel: number;
  curfew: boolean;
  hubPotentialScore: number;
  touristGatewayScore: number;
  businessGatewayScore: number;
}

export interface AircraftModel {
  id: string;
  manufacturer: string;
  name: string;
  family: string;
  role: AircraftRole;
  rangeKm: number;
  economyCapacity: number;
  businessCapacity: number;
  bellyCargoKg: number;
  fuelBurnKgPerHour: number;
  purchasePrice: number;
  monthlyLease: number;
  maintenancePerHour: number;
  crewPerHour: number;
  cruiseSpeedKmh: number;
  runwayRequirementM: number;
  turnaroundMinutes: number;
}

export interface NpcAirline {
  id: string;
  name: string;
  hubIata: string;
  reputation: number;
  priceBias: number;
  frequencyBias: number;
}

export interface Aircraft {
  id: string;
  modelId: string;
  acquisitionType: AcquisitionType;
  ageYears: number;
  reliability: number;
  assignedRouteIds: string[];
  utilizationHoursPerDay: number;
}

export interface RoutePerformance {
  date: string;
  passengers: number;
  loadFactor: number;
  revenue: number;
  costs: number;
  profit: number;
  availableSeatKm: number;
}

export interface Route {
  id: string;
  originIata: string;
  destinationIata: string;
  aircraftId: string;
  weeklyFrequency: number;
  operatingDays: number[];
  departureTime: string;
  economySeats: number;
  businessSeats: number;
  economyPrice: number;
  businessPrice: number;
  status: RouteStatus;
  performanceHistory: RoutePerformance[];
}

export interface DemandEstimate {
  business: number;
  leisure: number;
  vfr: number;
  total: number;
  expectedEconomyYield: number;
  expectedBusinessYield: number;
  seasonality: number;
}

export interface DailyFinancialReport {
  date: string;
  passengers: number;
  revenue: number;
  costs: number;
  profit: number;
  cask: number;
  rask: number;
  operatingMargin: number;
  routeResults: RoutePerformance[];
}

export interface WeeklyFinancialReport {
  startDate: string;
  endDate: string;
  passengers: number;
  revenue: number;
  costs: number;
  profit: number;
  operatingMargin: number;
}

export interface GameNotification {
  id: string;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
}

export interface GameState {
  schemaVersion: 1;
  currentDate: string;
  airlineName: string;
  hubIata: string;
  cash: number;
  reputation: number;
  fleet: Aircraft[];
  routes: Route[];
  npcAirlines: NpcAirline[];
  reports: {
    daily: DailyFinancialReport[];
    weekly: WeeklyFinancialReport[];
  };
  notifications: GameNotification[];
  currentView: GameView;
  debug: {
    errors: string[];
    npcEvents: string[];
    lastDemand: DemandEstimate[];
  };
}

export type NewGameInput = {
  airlineName: string;
  hubIata: "FCO" | "LHR" | "JFK" | "DXB" | "SIN" | "GRU";
};

export type AcquisitionInput = {
  modelId: string;
  acquisitionType: AcquisitionType;
};

export type RouteDraft = Omit<Route, "id" | "status" | "performanceHistory">;

export type RouteUpdate = { routeId: string } & Partial<
  Pick<
    Route,
    | "aircraftId"
    | "weeklyFrequency"
    | "operatingDays"
    | "departureTime"
    | "economySeats"
    | "businessSeats"
    | "economyPrice"
    | "businessPrice"
  >
>;
