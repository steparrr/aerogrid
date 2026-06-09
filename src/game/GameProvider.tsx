import { useReducer, type ReactNode } from "react";

import type { GameState } from "../domain/types";
import { GameContext } from "./gameContext";
import { gameReducer } from "./reducer";

export interface GameProviderProps {
  children: ReactNode;
  initialState?: GameState;
}

export function GameProvider({ children, initialState }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState ?? null);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}
