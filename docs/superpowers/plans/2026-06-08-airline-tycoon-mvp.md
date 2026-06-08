# Airline Tycoon Realistico MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire un MVP offline giocabile in cui il giocatore crea una compagnia con solo capitale, acquisisce aeromobili, sceglie manualmente le rotte, configura i suggerimenti del Route Planner e simula risultati giornalieri o settimanali.

**Architecture:** React e TypeScript presentano un'app a schermata singola guidata da uno store reducer persistito localmente. La simulazione resta in moduli TypeScript puri e testabili, separati da dati seed e componenti UI. La mappa mondiale è un SVG locale con proiezione equirettangolare, aeroporti e archi di rotta, così il gameplay funziona completamente offline.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, ESLint, CSS, SVG, localStorage

---

## File Structure

```text
airline-tycoon-realistico/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
├── src/
│   ├── main.tsx                         # Bootstrap React
│   ├── App.tsx                          # Routing interno e composizione app
│   ├── test/
│   │   ├── setup.ts                     # Matcher Testing Library
│   │   └── fixtures.ts                  # Fixture valide riusabili nei test
│   ├── styles/
│   │   ├── tokens.css                   # Colori, spacing, tipografia
│   │   ├── global.css                   # Reset e layout generali
│   │   └── responsive.css               # Vista mobile compatta
│   ├── domain/
│   │   ├── types.ts                     # Tipi condivisi del gioco
│   │   ├── validation.ts                # Validazione seed e stato
│   │   └── validation.test.ts
│   ├── data/
│   │   ├── cities.ts                    # Seed città
│   │   ├── airports.ts                  # Seed 40+ aeroporti
│   │   ├── aircraftModels.ts            # Catalogo aeromobili
│   │   ├── npcAirlines.ts               # 8 compagnie NPC
│   │   └── indexes.ts                   # Lookup e query dati
│   ├── simulation/
│   │   ├── geography.ts                 # Distanze e block time
│   │   ├── demand.ts                    # Domanda per segmento
│   │   ├── compatibility.ts             # Range, pista e utilizzo
│   │   ├── economics.ts                 # Costi, ricavi, metriche
│   │   ├── routePlanner.ts              # Suggerimenti su rotta scelta
│   │   ├── npc.ts                       # Decisioni NPC limitate
│   │   ├── advance.ts                   # Turno giornaliero/settimana
│   │   └── *.test.ts                    # Test unitari per modulo
│   ├── game/
│   │   ├── initialState.ts              # Nuova partita solo capitale
│   │   ├── reducer.ts                   # Azioni e invarianti partita
│   │   ├── selectors.ts                 # Dati derivati per UI
│   │   ├── persistence.ts               # Autosave/import/export
│   │   ├── GameProvider.tsx             # Context e comandi
│   │   └── *.test.ts
│   ├── components/
│   │   ├── AppShell.tsx                 # Sidebar, topbar, mobile nav
│   │   ├── WorldMap.tsx                 # Mappa SVG offline
│   │   ├── MetricCard.tsx
│   │   ├── DataTable.tsx
│   │   ├── Modal.tsx
│   │   └── TurnControls.tsx
│   └── features/
│       ├── new-game/NewGameScreen.tsx
│       ├── operations/OperationsScreen.tsx
│       ├── aircraft-market/AircraftMarketScreen.tsx
│       ├── airports/AirportsScreen.tsx
│       ├── route-planner/RoutePlannerScreen.tsx
│       ├── routes/RoutesScreen.tsx
│       ├── fleet/FleetScreen.tsx
│       ├── finance/FinanceScreen.tsx
│       ├── contracts/ContractsScreen.tsx
│       └── debug/SimulationDebugScreen.tsx
├── tests/
│   └── app-flow.test.tsx                 # Flusso MVP end-to-end nel DOM
└── README.md
```

## Milestone 1: Fondazione E Dati Verificati

### Task 1: Bootstrap React, TypeScript E Test Runner

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Create the project manifest**

Create `package.json` with scripts:

```json
{
  "name": "airline-tycoon-realistico",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.28.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.5.2",
    "eslint": "^9.28.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.2.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.8.3",
    "typescript-eslint": "^8.34.0",
    "vite": "^6.3.5",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `node_modules/` and `package-lock.json` created without audit-blocking errors.

- [ ] **Step 3: Write the failing smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the game title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Airline Tycoon Realistico" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `App` and test setup are not implemented.

- [ ] **Step 5: Implement the minimal shell and configs**

Create the Vite/TypeScript/ESLint configs, `index.html`, `src/main.tsx`, and this minimal `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main>
      <h1>Airline Tycoon Realistico</h1>
    </main>
  );
}
```

Configure Vitest with `environment: "jsdom"` and a setup file importing `@testing-library/jest-dom/vitest`.

- [ ] **Step 6: Verify foundation**

Run: `npm test -- src/App.test.tsx && npm run typecheck && npm run lint && npm run build`

Expected: all commands PASS and `dist/` is generated.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json index.html tsconfig.json vite.config.ts eslint.config.js src
git commit -m "chore: bootstrap airline tycoon web app"
```

### Task 2: Define Domain Types And Validate Seed Data

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/validation.ts`
- Create: `src/domain/validation.test.ts`
- Create: `src/data/cities.ts`
- Create: `src/data/airports.ts`
- Create: `src/data/aircraftModels.ts`
- Create: `src/data/npcAirlines.ts`
- Create: `src/data/indexes.ts`
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Write failing validation tests**

Create `src/domain/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { airports } from "../data/airports";
import { cities } from "../data/cities";
import { aircraftModels } from "../data/aircraftModels";
import { npcAirlines } from "../data/npcAirlines";
import { validateSeeds } from "./validation";

describe("seed validation", () => {
  it("contains at least 40 valid airports and all required hubs", () => {
    const result = validateSeeds({ airports, cities, aircraftModels, npcAirlines });
    expect(result.errors).toEqual([]);
    expect(airports.length).toBeGreaterThanOrEqual(40);
    expect(airports.map((airport) => airport.iata)).toEqual(
      expect.arrayContaining(["ATL", "JFK", "LAX", "LHR", "FCO", "DXB", "SIN", "GRU", "SYD"])
    );
  });

  it("contains exactly eight NPC airlines", () => {
    expect(npcAirlines).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run validation tests to verify failure**

Run: `npm test -- src/domain/validation.test.ts`

Expected: FAIL because domain types and seeds do not exist.

- [ ] **Step 3: Implement domain contracts**

Define strict interfaces in `src/domain/types.ts`, including:

```ts
export type Continent = "Europe" | "North America" | "South America" | "Africa" | "Middle East" | "Asia" | "Oceania";
export type AirportSize = "small" | "medium" | "large" | "megaHub";
export type AcquisitionType = "owned" | "leased";
export type RouteStatus = "active" | "suspended";
export type GameView = "operations" | "market" | "airports" | "planner" | "routes" | "fleet" | "finance" | "contracts" | "debug";

export interface Coordinates { lat: number; lon: number }
export interface City {
  id: string; name: string; country: string; continent: Continent;
  population: number; gdpPerCapita: number; tourismScore: number;
  businessScore: number; diasporaScore: number; coordinates: Coordinates;
  nearbyAirportIds: string[];
}
export interface Airport {
  id: string; iata: string; icao: string; name: string; cityId: string;
  country: string; continent: Continent; coordinates: Coordinates;
  airportSize: AirportSize; runwayLengthM: number; slotCapacityPerDay: number;
  terminalCapacityPerDay: number; baseFees: number; passengerFees: number;
  congestionLevel: number; curfew: boolean; hubPotentialScore: number;
  touristGatewayScore: number; businessGatewayScore: number;
}
export interface AircraftModel {
  id: string; manufacturer: string; name: string; family: string;
  rangeKm: number; economyCapacity: number; businessCapacity: number;
  bellyCargoKg: number; fuelBurnKgPerHour: number; purchasePrice: number;
  monthlyLease: number; maintenancePerHour: number; crewPerHour: number;
  cruiseSpeedKmh: number; runwayRequirementM: number; turnaroundMinutes: number;
}
export interface NpcAirline {
  id: string; name: string; hubIata: string; reputation: number;
  priceBias: number; frequencyBias: number;
}
export interface Aircraft {
  id: string; modelId: string; acquisitionType: AcquisitionType; ageYears: number;
  reliability: number; assignedRouteIds: string[]; utilizationHoursPerDay: number;
}
export interface RoutePerformance {
  date: string; passengers: number; loadFactor: number; revenue: number;
  costs: number; profit: number; availableSeatKm: number;
}
export interface Route {
  id: string; originIata: string; destinationIata: string; aircraftId: string;
  weeklyFrequency: number; operatingDays: number[]; departureTime: string;
  economySeats: number; businessSeats: number; economyPrice: number;
  businessPrice: number; status: RouteStatus; performanceHistory: RoutePerformance[];
}
export interface DemandEstimate {
  business: number; leisure: number; vfr: number; total: number;
  expectedEconomyYield: number; expectedBusinessYield: number; seasonality: number;
}
export interface DailyFinancialReport {
  date: string; passengers: number; revenue: number; costs: number; profit: number;
  cask: number; rask: number; operatingMargin: number; routeResults: RoutePerformance[];
}
export interface WeeklyFinancialReport {
  startDate: string; endDate: string; passengers: number; revenue: number;
  costs: number; profit: number; operatingMargin: number;
}
export interface GameNotification {
  id: string; severity: "info" | "warning" | "error"; title: string; message: string;
}
export interface GameState {
  schemaVersion: 1; currentDate: string; airlineName: string; hubIata: string;
  cash: number; reputation: number; fleet: Aircraft[]; routes: Route[];
  npcAirlines: NpcAirline[]; reports: { daily: DailyFinancialReport[]; weekly: WeeklyFinancialReport[] };
  notifications: GameNotification[]; currentView: GameView;
  debug: { errors: string[]; npcEvents: string[]; lastDemand: DemandEstimate[] };
}
```

Add action input types from the same contracts:

```ts
export type NewGameInput = { airlineName: string; hubIata: "FCO" | "LHR" | "JFK" | "DXB" | "SIN" | "GRU" };
export type AcquisitionInput = { modelId: string; acquisitionType: AcquisitionType };
export type RouteDraft = Omit<Route, "id" | "status" | "performanceHistory">;
export type RouteUpdate = { routeId: string } & Partial<Pick<Route,
  "aircraftId" | "weeklyFrequency" | "operatingDays" | "departureTime" |
  "economySeats" | "businessSeats" | "economyPrice" | "businessPrice"
>>;
```

- [ ] **Step 4: Implement complete seeds and indexes**

Create at least 40 internally consistent airports and related cities, all aircraft models named in the specification, and exactly 8 NPC airlines. Add indexed helpers:

```ts
export const airportByIata = new Map(airports.map((airport) => [airport.iata, airport]));
export const cityById = new Map(cities.map((city) => [city.id, city]));
export const aircraftModelById = new Map(aircraftModels.map((model) => [model.id, model]));
```

Create reusable valid fixtures in `src/test/fixtures.ts`:

```ts
import { npcAirlines } from "../data/npcAirlines";
import type { Aircraft, GameState, Route } from "../domain/types";

export function leased787Fixture(): Aircraft {
  return {
    id: "aircraft-test-787",
    modelId: "boeing-787-9",
    acquisitionType: "leased",
    ageYears: 2,
    reliability: 0.98,
    assignedRouteIds: [],
    utilizationHoursPerDay: 0
  };
}

export function playableStateFixture(): GameState {
  const aircraft = leased787Fixture();
  const route: Route = {
    id: "route-fco-jfk",
    originIata: "FCO",
    destinationIata: "JFK",
    aircraftId: aircraft.id,
    weeklyFrequency: 7,
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    departureTime: "10:00",
    economySeats: 250,
    businessSeats: 30,
    economyPrice: 620,
    businessPrice: 2400,
    status: "active",
    performanceHistory: []
  };
  return {
    schemaVersion: 1,
    currentDate: "2027-03-18",
    airlineName: "Aeria Test",
    hubIata: "FCO",
    cash: 50_000_000,
    reputation: 0.5,
    fleet: [{ ...aircraft, assignedRouteIds: [route.id] }],
    routes: [route],
    npcAirlines,
    reports: { daily: [], weekly: [] },
    notifications: [],
    currentView: "operations",
    debug: { errors: [], npcEvents: [], lastDemand: [] }
  };
}

export function validSaveFileFixture(state = playableStateFixture()): File {
  return new File(
    [JSON.stringify({ schemaVersion: 1, savedAt: "2027-03-18T12:00:00.000Z", game: state })],
    "aeria-save.json",
    { type: "application/json" }
  );
}
```

- [ ] **Step 5: Implement seed validation**

`validateSeeds()` must report duplicate IDs/IATA codes, missing city links, missing nearby airport links, invalid scores, impossible coordinates, invalid aircraft values, missing NPC hubs, and incorrect NPC count.

- [ ] **Step 6: Verify data**

Run: `npm test -- src/domain/validation.test.ts && npm run typecheck`

Expected: PASS with 40+ airports, required hubs, complete aircraft catalog, and 8 NPCs.

- [ ] **Step 7: Commit**

```bash
git add src/domain src/data src/test
git commit -m "feat: add validated world and aircraft seed data"
```

## Milestone 2: Motore Di Simulazione Puro

### Task 3: Geography And Passenger Demand

**Files:**
- Create: `src/simulation/geography.ts`
- Create: `src/simulation/geography.test.ts`
- Create: `src/simulation/demand.ts`
- Create: `src/simulation/demand.test.ts`

- [ ] **Step 1: Write failing geography and demand tests**

```ts
import { describe, expect, it } from "vitest";
import { airportByIata } from "../data/indexes";
import { calculateDistanceKm } from "./geography";
import { generateDailyODDemand } from "./demand";

describe("geography and demand", () => {
  it("calculates FCO-JFK within a realistic range", () => {
    const distance = calculateDistanceKm(airportByIata.get("FCO")!, airportByIata.get("JFK")!);
    expect(distance).toBeGreaterThan(6800);
    expect(distance).toBeLessThan(7100);
  });

  it("generates finite non-negative segmented demand", () => {
    const demand = generateDailyODDemand("2027-03-18", airportByIata.get("FCO")!, airportByIata.get("JFK")!);
    expect(demand.total).toBe(demand.business + demand.leisure + demand.vfr);
    expect(Object.values(demand).every((value) => typeof value !== "number" || Number.isFinite(value) && value >= 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/simulation/geography.test.ts src/simulation/demand.test.ts`

Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement geography**

Implement Haversine distance, block time, and equirectangular SVG projection:

```ts
export function projectToMap({ lat, lon }: Coordinates) {
  return { x: ((lon + 180) / 360) * 1000, y: ((90 - lat) / 180) * 500 };
}
```

- [ ] **Step 4: Implement deterministic demand**

`generateDailyODDemand()` must use origin/destination city and airport scores, distance bands, seasonal month factor, and deterministic formulas. Return:

```ts
interface DemandEstimate {
  business: number;
  leisure: number;
  vfr: number;
  total: number;
  expectedEconomyYield: number;
  expectedBusinessYield: number;
  seasonality: number;
}
```

Clamp every demand and yield output to finite, non-negative values.

- [ ] **Step 5: Verify demand**

Run: `npm test -- src/simulation/geography.test.ts src/simulation/demand.test.ts`

Expected: PASS; repeated calls with the same inputs return identical results.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/geography* src/simulation/demand*
git commit -m "feat: add deterministic geography and passenger demand"
```

### Task 4: Compatibility And Route Economics

**Files:**
- Create: `src/simulation/compatibility.ts`
- Create: `src/simulation/compatibility.test.ts`
- Create: `src/simulation/economics.ts`
- Create: `src/simulation/economics.test.ts`

- [ ] **Step 1: Write failing compatibility tests**

```ts
it("rejects an aircraft without enough range", () => {
  const result = checkRouteCompatibility({
    model: aircraftModelById.get("atr-72-600")!,
    origin: airportByIata.get("FCO")!,
    destination: airportByIata.get("JFK")!
  });
  expect(result.compatible).toBe(false);
  expect(result.reasons).toContain("range");
});

it("accepts a suitable long-haul aircraft", () => {
  const result = checkRouteCompatibility({
    model: aircraftModelById.get("boeing-787-9")!,
    origin: airportByIata.get("FCO")!,
    destination: airportByIata.get("JFK")!
  });
  expect(result.compatible).toBe(true);
});
```

- [ ] **Step 2: Write failing economics tests**

Test that trip cost, revenue, profit, CASK, RASK, and break-even load factor are finite, and that raising sold seats raises revenue.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/simulation/compatibility.test.ts src/simulation/economics.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement compatibility**

Check range with a 10% operational reserve, runway requirements at both airports, aircraft availability, and weekly utilization. Return explicit reason codes instead of throwing.

- [ ] **Step 5: Implement economics**

Implement pure functions:

```ts
calculateAircraftTripCost(input): CostBreakdown
calculateRouteRevenue(input): RevenueBreakdown
calculateRouteProfit(input): RouteFinancialEstimate
calculateCask(costs, availableSeatKm): number
calculateRask(revenue, availableSeatKm): number
calculateBreakEvenLoadFactor(costs, yieldPerSeat): number
```

Costs must include fuel, maintenance, crew, airport fees, handling/navigation, and a daily prorated lease charge whenever `aircraft.acquisitionType === "leased"`.

- [ ] **Step 6: Verify compatibility and economics**

Run: `npm test -- src/simulation/compatibility.test.ts src/simulation/economics.test.ts`

Expected: PASS without `NaN`, `Infinity`, or negative cost outputs.

- [ ] **Step 7: Commit**

```bash
git add src/simulation/compatibility* src/simulation/economics*
git commit -m "feat: add aircraft compatibility and route economics"
```

### Task 5: Route Planner For Player-Selected Routes

**Files:**
- Create: `src/simulation/routePlanner.ts`
- Create: `src/simulation/routePlanner.test.ts`

- [ ] **Step 1: Write failing planner tests**

```ts
import { leased787Fixture } from "../test/fixtures";

describe("route planner", () => {
  it("requires a route selected by the player", () => {
    expect(() => createRouteProposal({ originIata: "", destinationIata: "", fleet: [] }))
      .toThrow("Select origin and destination");
  });

  it("only recommends aircraft already in the player's fleet", () => {
    const leased787 = leased787Fixture();
    const proposal = createRouteProposal({
      originIata: "FCO",
      destinationIata: "JFK",
      fleet: [leased787]
    });
    expect(proposal.aircraftId).toBe(leased787.id);
    expect(proposal.originIata).toBe("FCO");
    expect(proposal.destinationIata).toBe("JFK");
  });
});
```

- [ ] **Step 2: Run planner tests to verify failure**

Run: `npm test -- src/simulation/routePlanner.test.ts`

Expected: FAIL because planner does not exist.

- [ ] **Step 3: Implement proposal generation**

`createRouteProposal()` must:

- require explicit origin/destination;
- reject identical endpoints;
- rank only compatible, available player aircraft;
- suggest frequency, operating days, departure time, prices, and class mix;
- include demand and financial forecast;
- include human-readable recommendation reasons and warnings;
- never return alternative destinations.

- [ ] **Step 4: Implement editable proposal recalculation**

Add `recalculateRouteProposal(draft, context)` so any manual change to aircraft, frequency, schedule, class configuration, or price updates demand capture and profit forecast without replacing the player's route selection.

- [ ] **Step 5: Verify planner**

Run: `npm test -- src/simulation/routePlanner.test.ts`

Expected: PASS; no test or function exposes autonomous destination suggestions.

- [ ] **Step 6: Commit**

```bash
git add src/simulation/routePlanner*
git commit -m "feat: add editable route planner proposals"
```

### Task 6: Daily Simulation, NPCs And Weekly Turns

**Files:**
- Create: `src/simulation/npc.ts`
- Create: `src/simulation/npc.test.ts`
- Create: `src/simulation/advance.ts`
- Create: `src/simulation/advance.test.ts`

- [ ] **Step 1: Write failing turn tests**

```ts
import { playableStateFixture } from "../test/fixtures";

it("advances exactly one calendar day", () => {
  const state = playableStateFixture();
  const next = advanceOneDay(state);
  expect(next.currentDate).toBe("2027-03-19");
  expect(next.reports.daily).toHaveLength(state.reports.daily.length + 1);
});

it("advances a week by processing seven daily turns", () => {
  const state = playableStateFixture();
  const next = advanceDays(state, 7);
  expect(next.currentDate).toBe("2027-03-25");
  expect(next.reports.daily).toHaveLength(state.reports.daily.length + 7);
});
```

- [ ] **Step 2: Write failing NPC tests**

```ts
it("keeps NPC changes inside declared bounds and deterministic for a date", () => {
  const state = playableStateFixture();
  const first = processNpcDay(state.npcAirlines, state.currentDate);
  const second = processNpcDay(state.npcAirlines, state.currentDate);
  expect(first).toEqual(second);
  for (const npc of first) {
    expect(npc.priceBias).toBeGreaterThanOrEqual(0.75);
    expect(npc.priceBias).toBeLessThanOrEqual(1.25);
    expect(npc.frequencyBias).toBeGreaterThanOrEqual(0.75);
    expect(npc.frequencyBias).toBeLessThanOrEqual(1.25);
  }
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/simulation/npc.test.ts src/simulation/advance.test.ts`

Expected: FAIL because turn engine does not exist.

- [ ] **Step 4: Implement NPC decisions**

Use deterministic seeded variation from date and airline ID. NPCs may adjust price bias and frequency within bounded ranges; they cannot access future state or create invalid routes.

- [ ] **Step 5: Implement daily turn pipeline**

`advanceOneDay()` must validate state, simulate each active route, aggregate route performance, apply acquisition and operating costs, update cash, execute NPC changes, append notifications/report, increment date, and return a new immutable state.

- [ ] **Step 6: Implement weekly turns**

`advanceDays(state, n)` loops through daily turns and returns the resulting `GameState`. It stops early only if a critical validation error is emitted, then records the processed-day count and interruption reason in an error notification and the debug state.

- [ ] **Step 7: Verify simulation**

Run: `npm test -- src/simulation/npc.test.ts src/simulation/advance.test.ts`

Expected: PASS; reports contain finite values and cash changes by the report profit.

- [ ] **Step 8: Commit**

```bash
git add src/simulation/npc* src/simulation/advance*
git commit -m "feat: add daily and weekly simulation turns"
```

## Milestone 3: Stato Partita E Persistenza

### Task 7: Game State, New Game, Aircraft Acquisition And Route Actions

**Files:**
- Create: `src/game/initialState.ts`
- Create: `src/game/reducer.ts`
- Create: `src/game/reducer.test.ts`
- Create: `src/game/selectors.ts`
- Create: `src/game/GameProvider.tsx`

- [ ] **Step 1: Write failing reducer tests**

Cover:

```ts
import { aircraftModelById } from "../data/indexes";
import { leased787Fixture, playableStateFixture } from "../test/fixtures";

it("creates a new game with capital and no aircraft", () => {
  const state = createNewGame({ airlineName: "Aeria", hubIata: "FCO" });
  expect(state.cash).toBeGreaterThan(0);
  expect(state.fleet).toEqual([]);
  expect(state.routes).toEqual([]);
});

it("leases an aircraft and reduces cash only by initial lease charge", () => {
  const state = createNewGame({ airlineName: "Aeria", hubIata: "FCO" });
  const next = gameReducer(state, {
    type: "ACQUIRE_AIRCRAFT",
    payload: { modelId: "boeing-787-9", acquisitionType: "leased" }
  });
  expect(next.fleet).toHaveLength(1);
  expect(next.cash).toBe(state.cash - aircraftModelById.get("boeing-787-9")!.monthlyLease);
});

it("blocks acquisition when cash is insufficient", () => {
  const state = { ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }), cash: 0 };
  const next = gameReducer(state, {
    type: "ACQUIRE_AIRCRAFT",
    payload: { modelId: "airbus-a380-800", acquisitionType: "owned" }
  });
  expect(next.fleet).toEqual([]);
  expect(next.notifications.at(-1)?.severity).toBe("error");
});

it("opens only a compatible route chosen by the player", () => {
  const aircraft = leased787Fixture();
  const state = { ...createNewGame({ airlineName: "Aeria", hubIata: "FCO" }), fleet: [aircraft] };
  const next = gameReducer(state, {
    type: "OPEN_ROUTE",
    payload: {
      originIata: "FCO", destinationIata: "JFK", aircraftId: aircraft.id,
      weeklyFrequency: 7, operatingDays: [1, 2, 3, 4, 5, 6, 7],
      departureTime: "10:00", economySeats: 250, businessSeats: 30,
      economyPrice: 620, businessPrice: 2400
    }
  });
  expect(next.routes).toHaveLength(1);
  expect(next.routes[0]).toMatchObject({ originIata: "FCO", destinationIata: "JFK" });
});

it("allows price edit and route suspension", () => {
  const state = playableStateFixture();
  const repriced = gameReducer(state, {
    type: "UPDATE_ROUTE",
    payload: { routeId: "route-fco-jfk", economyPrice: 700 }
  });
  const suspended = gameReducer(repriced, {
    type: "SET_ROUTE_STATUS",
    payload: { routeId: "route-fco-jfk", status: "suspended" }
  });
  expect(suspended.routes[0]).toMatchObject({ economyPrice: 700, status: "suspended" });
});
```

- [ ] **Step 2: Run reducer tests to verify failure**

Run: `npm test -- src/game/reducer.test.ts`

Expected: FAIL because state modules do not exist.

- [ ] **Step 3: Implement initial state**

`createNewGame()` validates airline name and hub against the six allowed starting hubs, sets a fixed balanced starting capital, initializes eight NPCs, and creates no player aircraft or routes.

- [ ] **Step 4: Implement reducer actions**

Define and implement:

```ts
type GameAction =
  | { type: "START_NEW_GAME"; payload: NewGameInput }
  | { type: "ACQUIRE_AIRCRAFT"; payload: AcquisitionInput }
  | { type: "OPEN_ROUTE"; payload: RouteDraft }
  | { type: "UPDATE_ROUTE"; payload: RouteUpdate }
  | { type: "SET_ROUTE_STATUS"; payload: { routeId: string; status: RouteStatus } }
  | { type: "ADVANCE_DAYS"; payload: { days: 1 | 7 } }
  | { type: "LOAD_GAME"; payload: GameState }
  | { type: "SET_VIEW"; payload: GameView };
```

Every invalid action adds a user-facing notification and leaves protected state unchanged.

- [ ] **Step 5: Implement selectors and provider**

Add selectors for latest report, route ranking, fleet utilization, finance totals, and mobile summary. `GameProvider` exposes state and typed commands without embedding simulation formulas, and accepts an optional `initialState` prop used only by tests:

```tsx
export function GameProvider({ children, initialState }: {
  children: React.ReactNode;
  initialState?: GameState;
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState ?? null);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}
```

- [ ] **Step 6: Verify game state**

Run: `npm test -- src/game/reducer.test.ts && npm run typecheck`

Expected: PASS; new game always begins with no fleet.

- [ ] **Step 7: Commit**

```bash
git add src/game
git commit -m "feat: add game state and player actions"
```

### Task 8: Autosave, Export And Safe Import

**Files:**
- Create: `src/game/persistence.ts`
- Create: `src/game/persistence.test.ts`
- Modify: `src/game/GameProvider.tsx`

- [ ] **Step 1: Write failing persistence tests**

```ts
import { playableStateFixture } from "../test/fixtures";

it("round-trips a valid versioned save", () => {
  const state = playableStateFixture();
  const serialized = serializeGame(state);
  expect(deserializeGame(serialized)).toEqual(state);
});

it("rejects corrupted saves without replacing the valid state", () => {
  expect(() => deserializeGame("{broken")).toThrow("Invalid save file");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/game/persistence.test.ts`

Expected: FAIL because persistence does not exist.

- [ ] **Step 3: Implement versioned persistence**

Use:

```ts
interface SaveEnvelope {
  schemaVersion: 1;
  savedAt: string;
  game: GameState;
}
```

Validate parsed JSON with existing validation functions before returning it.

- [ ] **Step 4: Connect autosave and file import/export**

Autosave after every state-changing action. Export creates a downloadable JSON blob. Import parses and validates before dispatching `LOAD_GAME`; on failure, keep current state and add a notification.

- [ ] **Step 5: Verify persistence**

Run: `npm test -- src/game/persistence.test.ts src/game/reducer.test.ts`

Expected: PASS, including corrupted input protection.

- [ ] **Step 6: Commit**

```bash
git add src/game
git commit -m "feat: add safe local game persistence"
```

## Milestone 4: Interfaccia Giocabile

### Task 9: Design System, Shell, New Game And World Map

**Files:**
- Modify: `src/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/WorldMap.tsx`
- Create: `src/components/MetricCard.tsx`
- Create: `src/components/DataTable.tsx`
- Create: `src/components/Modal.tsx`
- Create: `src/components/TurnControls.tsx`
- Create: `src/features/new-game/NewGameScreen.tsx`
- Create: `src/features/operations/OperationsScreen.tsx`
- Create: `src/features/operations/OperationsScreen.test.tsx`

- [ ] **Step 1: Generate and approve the full operations visual concept**

Use the frontend-app-builder and imagegen workflows to create one complete desktop primary-screen concept and one compact mobile concept based on the approved "Centro operativo bilanciato" layout. The concepts must show the local world map, route arcs, KPI, top/bottom routes, notifications, navigation, and both turn controls, using the approved serious premium dark operations style. Record the accepted concept paths before coding the UI.

- [ ] **Step 2: Write failing operations UI test**

```tsx
it("shows a new game first, then operations after creation", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Crea la tua compagnia" })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Nome compagnia"), "Aeria");
  await userEvent.selectOptions(screen.getByLabelText("Hub iniziale"), "FCO");
  await userEvent.click(screen.getByRole("button", { name: "Inizia partita" }));
  expect(screen.getByRole("heading", { name: "Centro operativo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Avanza 1 giorno" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Avanza 1 settimana" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run UI test to verify failure**

Run: `npm test -- src/features/operations/OperationsScreen.test.tsx`

Expected: FAIL because screens do not exist.

- [ ] **Step 4: Implement design tokens and shell**

Use the approved dark premium operations style: deep navy surfaces, cyan route accents, gold airport points, green/red semantic finance colors, compact desktop sidebar, and clear typography. Keep repeated components shared.

- [ ] **Step 5: Implement new game screen**

Require airline name and one of the six approved hubs. Clearly state starting capital and "Nessun aeromobile iniziale".

- [ ] **Step 6: Implement offline SVG world map**

Render airport points using `projectToMap()`, active route arcs, selected route state, and hub emphasis. Do not use remote map tiles.

- [ ] **Step 7: Implement operations screen**

Render map, latest KPI cards, top/bottom routes, notifications, and functional day/week buttons wired to game commands.

- [ ] **Step 8: Verify shell and operations**

Run: `npm test -- src/features/operations/OperationsScreen.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/styles src/components src/features/new-game src/features/operations
git commit -m "feat: add new game and operations center"
```

### Task 10: Aircraft Market, Airports And Demand Explorer

**Files:**
- Create: `src/features/aircraft-market/AircraftMarketScreen.tsx`
- Create: `src/features/aircraft-market/AircraftMarketScreen.test.tsx`
- Create: `src/features/airports/AirportsScreen.tsx`
- Create: `src/features/airports/AirportsScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing market and airports tests**

```tsx
it("leases an aircraft without showing autonomous route recommendations", async () => {
  render(<GameProvider initialState={playableStateFixture()}><AircraftMarketScreen /></GameProvider>);
  expect(screen.getByText("Raggio operativo")).toBeInTheDocument();
  expect(screen.queryByText("Rotte consigliate")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Leasing Boeing 787-9" }));
  expect(screen.getByText("Aeromobile acquisito")).toBeInTheDocument();
});

it("calculates demand only after manual endpoint selection", async () => {
  render(<AirportsScreen />);
  expect(screen.queryByText("Domanda totale giornaliera")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Origine"), "FCO");
  await userEvent.selectOptions(screen.getByLabelText("Destinazione"), "JFK");
  await userEvent.click(screen.getByRole("button", { name: "Calcola domanda" }));
  expect(screen.getByText("Domanda totale giornaliera")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/aircraft-market src/features/airports`

Expected: FAIL because screens do not exist.

- [ ] **Step 3: Implement aircraft market**

Show model cards/table with purchase price, lease, capacity, range, runway requirement, fuel burn, and acquisition confirmation. Visualize range from the hub on the local SVG map without suggesting destinations.

- [ ] **Step 4: Implement airports and demand explorer**

Show 40+ filterable airports. Let the player explicitly select origin and destination, then display segmented demand, yields, seasonality, distance, and current NPC competition.

- [ ] **Step 5: Verify market and airports**

Run: `npm test -- src/features/aircraft-market src/features/airports`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/aircraft-market src/features/airports src/App.tsx
git commit -m "feat: add aircraft market and demand explorer"
```

### Task 11: Editable Route Planner And Route Management

**Files:**
- Create: `src/features/route-planner/RoutePlannerScreen.tsx`
- Create: `src/features/route-planner/RoutePlannerScreen.test.tsx`
- Create: `src/features/routes/RoutesScreen.tsx`
- Create: `src/features/routes/RoutesScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing route planner tests**

```tsx
it("opens exactly the manually selected route after editable planning", async () => {
  render(<GameProvider initialState={playableStateFixture()}><RoutePlannerScreen /></GameProvider>);
  expect(screen.queryByText("Proposta operativa")).not.toBeInTheDocument();
  expect(screen.queryByText("Destinazioni consigliate")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Origine"), "FCO");
  await userEvent.selectOptions(screen.getByLabelText("Destinazione"), "LHR");
  await userEvent.click(screen.getByRole("button", { name: "Analizza rotta" }));
  const profitBefore = screen.getByTestId("forecast-profit").textContent;
  await userEvent.clear(screen.getByLabelText("Prezzo economy"));
  await userEvent.type(screen.getByLabelText("Prezzo economy"), "220");
  expect(screen.getByTestId("forecast-profit").textContent).not.toBe(profitBefore);
  await userEvent.click(screen.getByRole("button", { name: "Apri rotta FCO–LHR" }));
  expect(screen.getByText("FCO → LHR")).toBeInTheDocument();
});

it("reprices and suspends an existing route", async () => {
  render(<GameProvider initialState={playableStateFixture()}><RoutesScreen /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Modifica FCO–JFK" }));
  await userEvent.clear(screen.getByLabelText("Prezzo economy"));
  await userEvent.type(screen.getByLabelText("Prezzo economy"), "700");
  await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));
  await userEvent.click(screen.getByRole("button", { name: "Sospendi FCO–JFK" }));
  expect(screen.getByText("Sospesa")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/route-planner src/features/routes`

Expected: FAIL because screens do not exist.

- [ ] **Step 3: Implement planner quick mode**

After explicit route selection, show the recommended aircraft, schedule, class mix, prices, demand, costs, revenue, profit, reasons, and warnings with one "Apri rotta" action.

- [ ] **Step 4: Implement planner advanced editor**

Expose editable fields for aircraft, weekly frequency, operating days, departure time, economy/business seats, and prices. Recalculate forecast on every valid edit. Preserve origin/destination.

- [ ] **Step 5: Implement route management**

Show active/suspended routes, performance, aircraft, frequency, prices, NPC competition, and actions to edit, suspend, resume, or close.

- [ ] **Step 6: Verify route workflow**

Run: `npm test -- src/features/route-planner src/features/routes`

Expected: PASS; the exact manually selected route is opened.

- [ ] **Step 7: Commit**

```bash
git add src/features/route-planner src/features/routes src/App.tsx
git commit -m "feat: add editable route planner and route management"
```

### Task 12: Fleet, Finance, Contracts Placeholder And Debug Panel

**Files:**
- Create: `src/features/fleet/FleetScreen.tsx`
- Create: `src/features/finance/FinanceScreen.tsx`
- Create: `src/features/contracts/ContractsScreen.tsx`
- Create: `src/features/debug/SimulationDebugScreen.tsx`
- Create: `src/features/management-screens.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing management screen tests**

```tsx
it("shows fleet and finance facts from game state", () => {
  const state = playableStateFixture();
  render(<GameProvider initialState={state}><FleetScreen /></GameProvider>);
  expect(screen.getByText("Boeing 787-9")).toBeInTheDocument();
  expect(screen.getByText("FCO → JFK")).toBeInTheDocument();
  render(<GameProvider initialState={state}><FinanceScreen /></GameProvider>);
  expect(screen.getByText("CASK")).toBeInTheDocument();
  expect(screen.getByText("RASK")).toBeInTheDocument();
});

it("shows the contracts placeholder", () => {
  render(<ContractsScreen />);
  expect(screen.getByText("Feature prevista nel blocco successivo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/features/management-screens.test.tsx`

Expected: FAIL because screens do not exist.

- [ ] **Step 3: Implement fleet screen**

Show owned/leased state, assigned routes, daily utilization, reliability, cost, and compatibility warnings.

- [ ] **Step 4: Implement finance screen**

Show cash, report periods, revenue/cost categories, profit, operating margin, CASK, RASK, break-even load factor, and best/worst routes.

- [ ] **Step 5: Implement contracts and debug screens**

Contracts must show exactly `Feature prevista nel blocco successivo`. Debug must show state, last report, generated demand, NPC events, and errors only in development.

- [ ] **Step 6: Verify management screens**

Run: `npm test -- src/features/management-screens.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/fleet src/features/finance src/features/contracts src/features/debug src/features/management-screens.test.tsx src/App.tsx
git commit -m "feat: add fleet finance contracts and debug views"
```

## Milestone 5: Mobile, Full Flow E Consegna

### Task 13: Mobile Compact Control Experience

**Files:**
- Create: `src/styles/responsive.css`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/features/operations/OperationsScreen.tsx`
- Modify: `src/features/routes/RoutesScreen.tsx`
- Modify: `src/features/fleet/FleetScreen.tsx`
- Modify: `src/features/finance/FinanceScreen.tsx`
- Create: `src/features/mobile-behavior.test.tsx`

- [ ] **Step 1: Write failing mobile behavior tests**

```tsx
it("keeps essential turn controls in compact mode", () => {
  window.innerWidth = 390;
  window.dispatchEvent(new Event("resize"));
  render(<GameProvider initialState={playableStateFixture()}><OperationsScreen /></GameProvider>);
  expect(screen.getByRole("button", { name: "Avanza 1 giorno" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Avanza 1 settimana" })).toBeInTheDocument();
});

it("directs compact users to desktop for advanced planning", () => {
  window.innerWidth = 390;
  window.dispatchEvent(new Event("resize"));
  render(<GameProvider initialState={playableStateFixture()}><RoutePlannerScreen /></GameProvider>);
  expect(screen.getByText("Usa la vista desktop per modificare lo schedule avanzato")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run mobile tests to verify failure**

Run: `npm test -- src/features/mobile-behavior.test.tsx`

Expected: FAIL before responsive behavior is implemented.

- [ ] **Step 3: Implement compact navigation and layouts**

Use a bottom navigation on narrow screens, stack KPI and route summaries, preserve touch target sizes, and hide dense desktop-only controls behind a clear informational panel.

- [ ] **Step 4: Implement essential mobile actions**

Keep "Avanza 1 giorno", "Avanza 1 settimana", quick route price edits, and suspend/resume actions accessible.

- [ ] **Step 5: Verify mobile behavior**

Run: `npm test -- src/features/mobile-behavior.test.tsx && npm run typecheck`

Expected: PASS with no horizontal overflow in component-level checks.

- [ ] **Step 6: Commit**

```bash
git add src/styles/responsive.css src/components src/features
git commit -m "feat: add compact mobile control experience"
```

### Task 14: Full MVP Flow, Documentation And Final Verification

**Files:**
- Create: `tests/app-flow.test.tsx`
- Create: `README.md`
- Modify: any files required by failures found during verification

- [ ] **Step 1: Write the full failing MVP flow test**

```tsx
it("completes the full playable MVP loop", async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText("Nome compagnia"), "Aeria");
  await userEvent.selectOptions(screen.getByLabelText("Hub iniziale"), "FCO");
  await userEvent.click(screen.getByRole("button", { name: "Inizia partita" }));
  expect(screen.getByText("0 aeromobili")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("link", { name: "Mercato aeromobili" }));
  await userEvent.click(screen.getByRole("button", { name: "Leasing Airbus A320neo" }));

  await userEvent.click(screen.getByRole("link", { name: "Route Planner" }));
  await userEvent.selectOptions(screen.getByLabelText("Origine"), "FCO");
  await userEvent.selectOptions(screen.getByLabelText("Destinazione"), "LHR");
  await userEvent.click(screen.getByRole("button", { name: "Analizza rotta" }));
  await userEvent.clear(screen.getByLabelText("Prezzo economy"));
  await userEvent.type(screen.getByLabelText("Prezzo economy"), "220");
  await userEvent.click(screen.getByRole("button", { name: "Apri rotta FCO–LHR" }));

  await userEvent.click(screen.getByRole("link", { name: "Centro operativo" }));
  await userEvent.click(screen.getByRole("button", { name: "Avanza 1 giorno" }));
  await userEvent.click(screen.getByRole("button", { name: "Avanza 1 settimana" }));
  expect(screen.getByTestId("passengers-kpi")).not.toHaveTextContent("0");
  expect(screen.getByTestId("revenue-kpi")).toBeInTheDocument();
  expect(screen.getByTestId("costs-kpi")).toBeInTheDocument();
  expect(screen.getByTestId("profit-kpi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Esporta salvataggio" }));
  await userEvent.upload(screen.getByLabelText("Importa salvataggio"), validSaveFileFixture());
  expect(screen.getByText("Salvataggio importato")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the full flow test to expose integration gaps**

Run: `npm test -- tests/app-flow.test.tsx`

Expected: FAIL on any remaining integration issue.

- [ ] **Step 3: Fix integration failures**

Make the smallest changes required for the full flow to pass. Do not add post-MVP contract, cloud, loyalty, alliance, or cargo-freighter features.

- [ ] **Step 4: Write README**

Document:

```text
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Explain the playable loop, desktop/mobile scope, autosave/export/import, and current MVP limits.

- [ ] **Step 5: Run complete automated verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Run desktop browser verification**

Start `npm run dev`, open the local app in the in-app Browser, and verify:

- new game begins with only capital;
- aircraft market acquisition works;
- Route Planner never proposes destinations;
- manual route selection and advanced edits work;
- day/week turns update reports;
- operations, routes, fleet, airports, finance, contracts, and debug screens are navigable;
- import/export works.

- [ ] **Step 7: Run mobile browser verification**

Use an iPhone-sized viewport and verify:

- no horizontal overflow;
- KPI and notifications are readable;
- day/week controls work;
- quick route price and status actions work;
- dense planning controls clearly direct the user to desktop.

- [ ] **Step 8: Commit final MVP**

```bash
git add .
git commit -m "feat: complete playable airline tycoon MVP"
```

## Plan Self-Review Checklist

- Every acceptance criterion in the approved design maps to Tasks 2-14.
- The player always chooses origin and destination; no task adds autonomous route suggestions.
- A new game always starts with capital and no aircraft.
- Both one-day and one-week turn controls are implemented and tested.
- Mobile scope is intentionally compact rather than a complete planner.
- Contracts remain a clear placeholder.
- Simulation formulas remain outside UI components.
- All seed/state/import values are validated and protected against invalid numeric results.
- Final delivery requires test, typecheck, lint, build, desktop browser verification, and mobile browser verification.
