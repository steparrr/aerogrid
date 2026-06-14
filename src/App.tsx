import { useState } from "react";
import { GameProvider } from "./game/GameProvider";
import { useGame } from "./game/gameContext";
import { SplashScreen } from "./components/SplashScreen";
import { NewGameScreen } from "./components/NewGameScreen";
import { OperationsScreen } from "./components/OperationsScreen";
import { FinanceScreen } from "./components/FinanceScreen";
import { FleetScreen } from "./components/FleetScreen";
import { RoutesScreen } from "./components/RoutesScreen";
import { RoutePlannerScreen } from "./components/RoutePlannerScreen";
import { PricingScreen } from "./components/PricingScreen";
import { ContractsScreen } from "./components/ContractsScreen";
import { YieldManagement } from "./screens/YieldManagement";
import { RouteStudy } from "./screens/RouteStudy";
import { Maintenance } from "./screens/Maintenance";
import { Distribution } from "./screens/Distribution";
import { Staff } from "./screens/Staff";
import { Progression } from "./screens/Progression";
import { Missions } from "./screens/Missions";
import { Rotations } from "./screens/Rotations";
import { AirportConceptual } from "./screens/AirportConceptual";
import { AirportPhysical } from "./screens/AirportPhysical";
import { WorldMapScreen } from "./screens/WorldMapScreen";
import { CompetitorScreen } from "./screens/CompetitorScreen";
import { TerminalMap } from "./screens/TerminalMap";
import { AircraftCatalog } from "./screens/AircraftCatalog";
import { AUTOSAVE_KEY } from "./game/persistence";
import { SaveDebugPanel } from "./components/SaveDebugPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { GameView, GameState } from "./domain/types";

function hasSavedGame(): boolean {
  try {
    return !!localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return false;
  }
}

function GameRouter() {
  const { state, dispatch } = useGame();

  if (!state) {
    return (
      <NewGameScreen
        onStart={(s) =>
          dispatch({
            type: "START_NEW_GAME",
            payload: { airlineName: s.airlineName, hubIata: s.hubIata },
          })
        }
      />
    );
  }

  const handleNavigate = (view: GameView) =>
    dispatch({ type: "SET_VIEW", payload: view });

  const handleUpdate = (next: GameState) =>
    dispatch({ type: "LOAD_GAME", payload: next });

  const handleReset = () => {
    if (confirm("Sei sicuro di voler uscire? Il progresso sarà perso.")) {
      dispatch({ type: "RESET_GAME" });
    }
  };

  switch (state.currentView) {
    case "fleet":
      return <FleetScreen />;
    case "routes":
      return <RoutesScreen />;
    case "planner":
      return <RoutePlannerScreen />;
    case "finance":
      return <FinanceScreen game={state} onNavigate={handleNavigate} />;
    case "market":
      return <PricingScreen game={state} onNavigate={handleNavigate} onUpdate={handleUpdate} />;
    case "contracts":
      return <ContractsScreen game={state} onNavigate={handleNavigate} onUpdate={handleUpdate} />;
    case "rotations":
      return <Rotations game={state} onNavigate={handleNavigate} onUpdate={handleUpdate} />;
    case "yield":
      return <YieldManagement game={state} onUpdate={handleUpdate} />;
    case "route-study":
      return <RouteStudy game={state} />;
    case "maintenance":
      return <Maintenance game={state} onNavigate={handleNavigate} onUpdate={handleUpdate} />;
    case "distribution":
      return <Distribution game={state} />;
    case "staff":
      return <Staff game={state} />;
    case "progression":
      return <Progression game={state} />;
    case "missions":
      return <Missions />;
    case "world-map":
      return <WorldMapScreen />;
    case "competitors":
      return <CompetitorScreen />;
    case "airport-conceptual":
      return <AirportConceptual />;
    case "airport-physical":
      return <AirportPhysical />;
    case "terminal-map":
      return <TerminalMap />;
    case "aircraft-catalog":
      return <AircraftCatalog />;
    case "operations":
    default:
      return <OperationsScreen game={state} onNavigate={handleNavigate} onReset={handleReset} />;
  }
}

export default function App() {
  const [splashDone, setSplashDone] = useState(() => hasSavedGame());

  if (!splashDone) {
    return <SplashScreen onEnter={() => setSplashDone(true)} />;
  }

  return (
    <ErrorBoundary>
      <GameProvider>
        <ErrorBoundary>
          <GameRouter />
        </ErrorBoundary>
        <SaveDebugPanel />
      </GameProvider>
    </ErrorBoundary>
  );
}
