import { GameProvider } from "./game/GameProvider";
import { useGame } from "./game/gameContext";
import { NewGameScreen } from "./components/NewGameScreen";
import { OperationsScreen } from "./components/OperationsScreen";
import { FinanceScreen } from "./components/FinanceScreen";
import { FleetScreen } from "./components/FleetScreen";
import { RoutesScreen } from "./components/RoutesScreen";
import { RoutePlannerScreen } from "./components/RoutePlannerScreen";
import { PricingScreen } from "./components/PricingScreen";
import { ContractsScreen } from "./components/ContractsScreen";

function GameRouter() {
  const { state, dispatch } = useGame();

  if (!state) {
    return (
      <NewGameScreen
        onStart={s => dispatch({ type: "START_NEW_GAME", payload: { airlineName: s.airlineName, hubIata: s.hubIata as import("./domain/types").NewGameInput["hubIata"] } })}
      />
    );
  }

  // Adattatori per schermate che usano ancora la vecchia API prop-based
  const handleNavigate = (view: import("./domain/types").GameView) =>
    dispatch({ type: "SET_VIEW", payload: view });

  const handleUpdate = (next: import("./domain/types").GameState) =>
    dispatch({ type: "LOAD_GAME", payload: next });

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
    case "operations":
    default:
      return <OperationsScreen game={state} onNavigate={handleNavigate} />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
