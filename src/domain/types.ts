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
export type AcquisitionType = "owned" | "leased" | "acmi" | "sale_leaseback";
export type RouteStatus = "active" | "suspended";
export type GameView =
  | "operations"
  | "rotations"
  | "yield"
  | "route-study"
  | "maintenance"
  | "distribution"
  | "staff"
  | "progression"
  | "missions"
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
  slot_pool_available?: number;
  slot_market_price?: number;
  pax_demand?: DemandProfile;
  fuel_price_differential?: number;
  landing_fee_base?: number;
  handling_fee_base?: number;
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
  registration?: string;
  condition?: number;
  market_value?: number;
  cabin_config?: CabinConfig;
  contract?: LeaseContract;
  assigned_route_id?: string;
  retrofit_job?: RetrofitJob;
  status?: AircraftAssetStatus;
  maintenance_next_c_check?: number;
  maintenance_next_d_check?: number;
  flight_hours_since_a_check?: number;
  cycles_since_engine_overhaul?: number;
  maintenance_reserve_balance?: number;
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
  pricing_strategy?: PricingStrategy;
  overbooking_level?: OverbookingLevel;
  opened_date?: GameDate;
  load_factor?: number;
  revenue_monthly?: number;
  cost_monthly?: number;
  margin_monthly?: number;
  nps_this_route?: number;
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
  turn: number;
  game_date: GameDate;
  player: PlayerAirline;
  competitors: CompetitorAirline[];
  airports: Record<string, Airport>;
  market_fuel_price: number;
  game_mode: GameMode;
  origin: GameOrigin | null;
  victory_path: VictoryPath | null;
  events_log: GameEvent[];
  pending_decisions: PendingDecision[];
  consecutive_negative_cash_turns: number;
  game_status: "ACTIVE" | "BANKRUPT" | "VICTORY";
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

export type GameOrigin = "LCC" | "REGIONAL" | "LEGACY";
export type VictoryPath = "NETWORK" | "PROFIT" | "DOMINATOR" | "GREEN";
export type GameMode = "MISSION" | "SANDBOX" | "CAMPAIGN";
export type PricingStrategy =
  | "YIELD_MAXIMIZER"
  | "LOAD_MAXIMIZER"
  | "COMPETITOR_MATCH"
  | "PRICE_LEADER"
  | "PREMIUM";
export type OverbookingLevel = "OFF" | "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
export type AircraftAssetStatus =
  | "AVAILABLE"
  | "IN_SERVICE"
  | "IN_RETROFIT"
  | "IN_MAINTENANCE"
  | "PENDING_DELIVERY"
  | "available"
  | "in_service"
  | "in_retrofit"
  | "in_maintenance"
  | "pending_delivery";
export type CompetitorArchetype =
  | "LEGACY_DOMINANT"
  | "LEGACY_WEAK"
  | "LCC"
  | "ULCC"
  | "REGIONAL"
  | "GULF_CARRIER";
export type DistributionChannel =
  | "DIRECT"
  | "GDS"
  | "OTA"
  | "METASEARCH"
  | "CORPORATE"
  | "NDC";
export type CarbonRating = "A" | "B" | "C" | "D" | "F";
export type PlayerLevel = 1 | 2 | 3 | 4 | 5;

export interface GameDate {
  year: number;
  month: number;
}

export interface DemandProfile {
  corporate: number;
  leisure: number;
  vfr: number;
  mice: number;
  student: number;
  transit: number;
  seasonality: number[];
}

export interface SlotAsset {
  airport_id?: string;
  owner_id?: string;
  purchase_price?: number;
  market_value?: number;
  utilization_this_season?: number;
  airportIata?: string;
  purchasePrice?: number;
  marketValue?: number;
  utilizationThisSeason?: number;
  status: "ACTIVE" | "AT_RISK" | "LOST";
}

export interface CabinConfig {
  first_pct: number;
  business_pct: number;
  premium_eco_pct: number;
  economy_pct: number;
  first_seats: number;
  business_seats: number;
  premium_eco_seats: number;
  economy_seats: number;
  total_seats: number;
}

export interface LeaseContract {
  id: string;
  monthly_rate: number;
  deposit: number;
  duration_months: number;
  remaining_months: number;
  maintenance_reserve_monthly: number;
}

export interface RetrofitJob {
  id: string;
  target_config: CabinConfig;
  turns_remaining: number;
  cost: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
}

export type AircraftAsset = Aircraft;
export type AircraftCatalog = AircraftModel;

export interface LoyaltyProgram {
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  miles_outstanding?: number;
  breakage_rate?: number;
  milesOutstanding?: number;
  breakageRate?: number;
}

export interface FuelHedge {
  type: "CALL_OPTION" | "COLLAR" | "SWAP";
  coverage_pct?: number;
  duration_months?: number;
  strike_price?: number;
  premium_paid?: number;
  monthly_saving?: number;
  coveragePct: number;
  durationMonths: number;
  strikePrice: number;
  premiumPaid: number;
  monthlySaving: number;
  startDate?: string;
  status: "ACTIVE" | "EXPIRED" | "EXERCISED";
}

export interface CarbonScore {
  rating: CarbonRating;
  emissions_per_pax_km?: number;
  industry_benchmark?: number;
  corsia_monthly?: number;
  ets_monthly?: number;
  saf_blend_pct?: number;
  total_compliance_cost_monthly?: number;
  emissionsPerPaxKm: number;
  industryBenchmark: number;
  corsiaMonthly: number;
  etsMonthly: number;
  safBlendPct: number;
  totalComplianceCostMonthly: number;
}

export interface MaintenanceEvent {
  id: string;
  aircraft_id: string;
  check_type: "A_CHECK" | "C_CHECK" | "D_CHECK" | "ENGINE_OVERHAUL";
  due_turn: number;
  cost_estimate: number;
  duration_days: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
}

export interface StaffMetrics {
  pilots_available?: number;
  pilots_required?: number;
  pilots_in_training?: number;
  union_morale?: number;
  union_contract_expires_turn?: number;
  strike_risk?: number;
  pilotsNarrow?: number;
  pilotsWide?: number;
  pilotsRequiredNarrow?: number;
  pilotsRequiredWide?: number;
  unionMorale?: number;
  unionContractExpiresDate?: string;
  strikeRisk?: number;
}

export interface DistributionStrategy {
  channels: DistributionChannel[];
  channel_mix?: Partial<Record<DistributionChannel, number>>;
  channelMix?: Partial<Record<DistributionChannel, number>>;
  ndc_migration_turns_remaining?: number;
}

export interface NpcMemory {
  lastPlayerActions: Array<{ type: string; date: string; magnitude?: number }>;
  aggressionLevel: number;
  price_response_history?: Array<{ date: string; pct: number; trigger: string }>;
  route_entry_history?: Array<{
    date: string;
    routeKey: string;
    eventType: "ENTER" | "EXIT";
  }>;
}

export interface CompetitorAirline extends NpcAirline {
  archetype?: CompetitorArchetype;
  active_routes?: string[];
  activeRoutes?: string[];
  cash?: number;
  price_cut_this_turn?: number;
  memory?: NpcMemory;
}

export type NpcAirlineExtended = CompetitorAirline;

export interface AircraftExtended extends Aircraft {
  flightHoursSinceACheck?: number;
  turnsSinceCCheck?: number;
  turnsSinceEngineOverhaul?: number;
  totalCycles?: number;
}

export interface CoreKPIs {
  load_factor_avg: number;
  otp_rate: number;
  aircraft_utilization: number;
  cask: number;
  rask: number;
  ebitda_margin: number;
  net_debt_to_ebitda: number;
  nps: number;
  brand_score: number;
  ancillary_per_pax: number;
  hub_dominance_pct: number;
  loyalty_tier: 0 | 1 | 2 | 3 | 4 | 5;
  fleet_utilization_efficiency: number;
  carbon_score_rating: CarbonRating;
  saf_blend_pct: number;
}

export interface PlayerAirline {
  id: string;
  name: string;
  hub: string;
  cash: number;
  debt: number;
  fleet: Aircraft[];
  routes: Route[];
  slots: SlotAsset[];
  loyalty: LoyaltyProgram;
  distribution: DistributionStrategy;
  staff: StaffMetrics;
  brand_score: number;
  nps: number;
  carbon_score: CarbonScore;
  game_date: GameDate;
  level: PlayerLevel;
  core_kpis: CoreKPIs;
  fuel_hedges: FuelHedge[];
  maintenance_events: MaintenanceEvent[];
}

export interface GameEvent {
  id: string;
  turn: number;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface PendingDecision {
  id: string;
  type: string;
  message: string;
  created_turn: number;
  irreversible: boolean;
}

export interface AogEvent {
  id: string;
  aircraftId: string;
  date: string;
  durationMinutes: number;
  directCost: number;
  eu261Cost: number;
  brandImpact: number;
}

export interface GameStateExtended {
  gameMode?: GameMode;
  origin?: GameOrigin;
  victoryPath?: VictoryPath;
  playerLevel?: PlayerLevel;
  slots?: SlotAsset[];
  loyalty?: LoyaltyProgram;
  fuelHedges?: FuelHedge[];
  carbonScore?: CarbonScore;
  maintenanceSchedule?: MaintenanceEvent[];
  aogHistory?: AogEvent[];
  staff?: StaffMetrics;
  distribution?: DistributionStrategy;
  kpis?: CoreKPIs;
  marketFuelPricePerKg?: number;
  consecutiveNegativeCashDays?: number;
  gameOver?: boolean;
  victory?: boolean;
}

export type FullGameState = GameState & GameStateExtended;

export type NewGameInputExtended = NewGameInput & {
  game_mode?: GameMode;
  origin?: GameOrigin;
  victory_path?: VictoryPath;
};
