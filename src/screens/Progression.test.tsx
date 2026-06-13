import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { GameState, Route } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { Progression } from "./Progression";

afterEach(cleanup);

function routes(state: GameState, count: number): Route[] {
  return Array.from({ length: count }, (_, index) => ({
    ...state.routes[0],
    id: `progression-route-${index}`,
    destinationIata: index % 2 === 0 ? "JFK" : "FCO",
    status: "active",
  }));
}

function levelTwoState() {
  const base = playableStateFixture();
  const fleet = base.fleet.map((aircraft) => ({
    ...aircraft,
    modelId: "airbus-a220-300",
  }));
  const activeRoutes = routes(base, 11);

  return {
    ...base,
    fleet,
    routes: activeRoutes,
    player: {
      ...base.player,
      level: 2 as const,
      fleet,
      routes: activeRoutes,
      core_kpis: {
        ...base.player.core_kpis,
        hub_dominance_pct: 0.192,
      },
    },
  };
}

describe("Progression screen", () => {
  it("shows the current level, real KPI progress and inline locked prerequisites", () => {
    render(<Progression game={levelTwoState()} />);

    expect(
      screen.getByRole("heading", { name: "Progressione" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("L2 REGIONAL").length).toBeGreaterThan(0);
    expect(screen.getByText("19.2% / 30%")).toBeInTheDocument();
    expect(screen.getByText(/manca solo hub share >30%/i)).toBeInTheDocument();

    const lockedFeature = screen.getByRole("button", {
      name: /fuel hedging.*disponibile al livello 3/i,
    });
    expect(lockedFeature).not.toBeDisabled();
  });

  it("renders milestone timeline states from the game and switches tabs", () => {
    render(<Progression game={levelTwoState()} />);

    fireEvent.click(screen.getByRole("button", { name: "Milestone" }));

    expect(screen.getByText("Prima Rotta Redditizia")).toBeInTheDocument();
    expect(screen.getByText("Il Tuo Primo Hub")).toBeInTheDocument();
    expect(screen.getByText(/in corso/i)).toBeInTheDocument();
    expect(screen.getAllByText(/disponibile al livello 3/i).length).toBeGreaterThan(0);
  });

  it("shows and dismisses the non-blocking narrative level-up card", () => {
    const base = playableStateFixture();
    const activeRoutes = routes(base, 8);
    const eligible = {
      ...base,
      routes: activeRoutes,
      player: {
        ...base.player,
        level: 1 as const,
        routes: activeRoutes,
      },
    };

    render(<Progression game={eligible} />);

    const dialog = screen.getByRole("dialog", { name: /nuovo livello/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "REGIONAL" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continua a giocare/i }));
    expect(screen.queryByRole("dialog", { name: /nuovo livello/i })).not.toBeInTheDocument();
  });
});
