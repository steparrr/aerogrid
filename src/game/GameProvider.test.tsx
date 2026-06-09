import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import { GameProvider } from "./GameProvider";
import { useGame } from "./gameContext";
import { AUTOSAVE_KEY, deserializeGame } from "./persistence";

function Consumer() {
  const { state, dispatch, exportGame, importGame } = useGame();

  return (
    <>
      <output aria-label="airline">{state?.airlineName ?? "none"}</output>
      <output aria-label="notifications">
        {state?.notifications.length ?? 0}
      </output>
      <button
        type="button"
        onClick={() => dispatch({ type: "SET_VIEW", payload: "finance" })}
      >
        Finance
      </button>
      <button type="button" onClick={() => importGame("{broken")}>
        Bad import
      </button>
      <button
        type="button"
        onClick={() => {
          void exportGame();
        }}
      >
        Export
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("GameProvider persistence", () => {
  it("autosaves the initial state and every state-changing action", async () => {
    const state = playableStateFixture();
    render(
      <GameProvider initialState={state}>
        <Consumer />
      </GameProvider>,
    );

    await waitFor(() =>
      expect(deserializeGame(localStorage.getItem(AUTOSAVE_KEY)!)).toEqual(state),
    );

    act(() => {
      screen.getByRole("button", { name: "Finance" }).click();
    });

    await waitFor(() =>
      expect(
        deserializeGame(localStorage.getItem(AUTOSAVE_KEY)!).currentView,
      ).toBe("finance"),
    );
  });

  it("keeps the current state and adds an error notification on bad import", () => {
    const state = playableStateFixture();
    render(
      <GameProvider initialState={state}>
        <Consumer />
      </GameProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Bad import" }).click();
    });

    expect(screen.getByLabelText("airline")).toHaveTextContent(state.airlineName);
    expect(screen.getByLabelText("notifications")).toHaveTextContent("1");
  });
});
