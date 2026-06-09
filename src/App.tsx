import { useState, useCallback } from "react";
import type { GameState, GameView } from "./domain/types";
import { NewGameScreen } from "./components/NewGameScreen";
import { OperationsScreen } from "./components/OperationsScreen";
import { FinanceScreen } from "./components/FinanceScreen";
import { saveGame, loadGame } from "./game/persistence";

function initialState(): GameState | null {
  return loadGame();
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(initialState);

  const handleStart = useCallback((state: GameState) => {
    saveGame(state);
    setGame(state);
  }, []);

  const handleNavigate = useCallback((view: GameView) => {
    setGame(prev => {
      if (!prev) return prev;
      const next: GameState = { ...prev, currentView: view };
      saveGame(next);
      return next;
    });
  }, []);

  if (!game) {
    return <NewGameScreen onStart={handleStart} />;
  }

  switch (game.currentView) {
    case "finance":
      return <FinanceScreen game={game} onNavigate={handleNavigate} />;
    case "operations":
    default:
      return <OperationsScreen game={game} onNavigate={handleNavigate} />;
  }
}
