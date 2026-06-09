import { createContext, useContext } from "react";

import type { GameState } from "../domain/types";
import type { GameAction } from "./reducer";

export interface GameContextValue {
  state: GameState | null;
  dispatch: React.Dispatch<GameAction>;
}

export const GameContext = createContext<GameContextValue | undefined>(
  undefined,
);

export function useGame() {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error("useGame must be used inside GameProvider");
  }

  return context;
}
