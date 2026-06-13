import { useGame } from "../game/gameContext";
import type { GameView } from "../domain/types";

interface Props {
  to?: GameView;
}

export function BackButton({ to = "operations" }: Props) {
  const { dispatch } = useGame();
  return (
    <button
      onClick={() => dispatch({ type: "SET_VIEW", payload: to })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        flexShrink: 0,
        background: "none",
        border: "1px solid var(--color-border, #1E2D45)",
        borderRadius: "50%",
        color: "var(--color-text, #E8EDF5)",
        fontSize: 18,
        cursor: "pointer",
        lineHeight: 1,
      }}
      aria-label="Torna indietro"
    >
      ←
    </button>
  );
}
