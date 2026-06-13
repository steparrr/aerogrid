import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";

import type { GameState } from "../domain/types";
import { GameContext } from "./gameContext";
import {
  createGameExport,
  deserializeGame,
  loadAutosavedGame,
  saveGameLocally,
} from "./persistence";
import { gameReducer } from "./reducer";
import { synchronizeGameState } from "./stateSync";

export interface GameProviderProps {
  children: ReactNode;
  initialState?: GameState;
}

export function GameProvider({ children, initialState }: GameProviderProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initialState,
    (providedState) =>
      providedState ? synchronizeGameState(providedState) : loadAutosavedGame(),
  );

  useEffect(() => {
    if (state) {
      try {
        saveGameLocally(state);
      } catch {
        // Browsers can reject localStorage writes; the current game remains valid.
      }
    }
  }, [state]);

  const exportGame = useCallback(
    () => (state ? createGameExport(state) : null),
    [state],
  );

  const importGame = useCallback(
    (serialized: string) => {
      try {
        dispatch({ type: "LOAD_GAME", payload: deserializeGame(serialized) });
        return true;
      } catch (error) {
        dispatch({
          type: "REPORT_ERROR",
          payload: {
            title: "Import failed",
            message:
              error instanceof Error ? error.message : "Invalid save file",
          },
        });
        return false;
      }
    },
    [dispatch],
  );

  const contextValue = useMemo(
    () => ({ state, dispatch, exportGame, importGame }),
    [state, exportGame, importGame],
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}
