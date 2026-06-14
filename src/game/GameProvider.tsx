import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";

import type { GameState } from "../domain/types";
import { GameContext } from "./gameContext";
import {
  AUTOSAVE_KEY,
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
    if (!state) return; // Never delete the save key automatically — only RESET_GAME should clear it
    try {
      saveGameLocally(state);
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.error("[AeroGrid save] QuotaExceededError — il salvataggio è troppo grande per localStorage", e);
      } else {
        console.error("[AeroGrid save] Errore inatteso durante il salvataggio:", e);
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
