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
import type { GameView, GameState, NewGameInput } from "./domain/types";

function GameRouter() {
  const { state, dispatch } = useGame();

  if (!state) {
    return (
      <NewGameScreen
        onStart={(s: { airlineName: string; hubIata: string }) =>
          dispatch({
            type: "START_NEW_GAME",
            payload: { airlineName: s.airlineName, hubIata: s.hubIata as NewGameInput["hubIata"] },
          })
        }
      />
    );
  }

  const handleNavigate = (view: GameView) =>
    dispatch({ type: "SET_VIEW", payload: view });

  const handleUpdate = (next: GameState) =>
    dispatch({ type: "LOAD_GAME", payload: next });

  switch (state.currentView) {
    // Schermate principali
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

    // Schermate avanzate (da src/screens/)
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

    case "operations":
    default:
      return <OperationsScreen game={state} onNavigate={handleNavigate} />;
  }
}

export default function App() {
  // Mostra splash solo al primo caricamento della sessione
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <SplashScreen onEnter={() => setSplashDone(true)} />;
  }

  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
