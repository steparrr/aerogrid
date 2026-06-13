import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompetitorAirline, GameState } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { RouteStudy } from "./RouteStudy";

afterEach(cleanup);

function routeStudyGame(level: 1 | 2 | 3 | 4 = 4): GameState {
  const base = playableStateFixture();
  const competitor: CompetitorAirline = {
    ...base.competitors[0]!,
    name: "Britannia Test",
    activeRoutes: ["FCO-LHR"],
    archetype: "LEGACY_DOMINANT",
    memory: {
      aggressionLevel: 70,
      lastPlayerActions: [],
      price_response_history: [
        { date: "2027-02-01", pct: 0.1, trigger: "PLAYER_OPENS_ROUTE" },
      ],
      route_entry_history: [],
    },
  };

  return {
    ...base,
    player: { ...base.player, level },
    competitors: [competitor],
    airports: {
      ...base.airports,
      LHR: {
        ...base.airports.LHR!,
        slot_pool_available: 1,
      },
    },
  };
}

describe("RouteStudy screen", () => {
  it("renders real market data and changes route from GameState airports", () => {
    render(
      <RouteStudy
        game={routeStudyGame()}
        originIata="FCO"
        destinationIata="LHR"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Studio Rotta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("6 segmenti passeggeri")).toBeInTheDocument();
    expect(screen.getByText("Turismo destinazione")).toBeInTheDocument();
    expect(screen.getByText("Dic")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Destinazione"), {
      target: { value: "JFK" },
    });

    expect(screen.getByText(/FCO → JFK/)).toBeInTheDocument();
  });

  it("shows competitor, finance and risk analytics from the study engine", () => {
    render(
      <RouteStudy
        game={routeStudyGame()}
        originIata="FCO"
        destinationIata="LHR"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Competitor" }));
    expect(screen.getByText("Britannia Test")).toBeInTheDocument();
    expect(screen.getByText(/risposta attesa/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finanze" }));
    expect(screen.getByText(/break-even load factor/i)).toBeInTheDocument();
    expect(screen.getByText(/NPV semplificato/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rischi" }));
    expect(screen.getByText(/score rischio/i)).toBeInTheDocument();
    expect(screen.getByText(/costo ETS non disponibile/i)).toBeInTheDocument();
  });

  it("keeps higher-tier data visibly locked and opens route configuration when prerequisites pass", () => {
    const onOpenRoute = vi.fn();
    render(
      <RouteStudy
        game={routeStudyGame(1)}
        originIata="FCO"
        destinationIata="LHR"
        intelligenceTier={1}
        onOpenRoute={onOpenRoute}
      />,
    );

    expect(screen.getAllByText(/sblocca T2/i).length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /apri questa rotta/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Configura nuova rotta" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Frequenza settimanale" }),
      { target: { value: "3" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Prezzo economy" }),
      { target: { value: "700" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Conferma apertura" }));
    expect(onOpenRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        weeklyFrequency: 3,
        economyPrice: 700,
      }),
    );
  });

  it("shows missing prerequisites inline while leaving the open-route action enabled", () => {
    const game = routeStudyGame();
    const withoutCompatibleAircraft = {
      ...game,
      fleet: game.fleet.map((aircraft) => ({
        ...aircraft,
        modelId: "atr-72-600",
      })),
    };

    render(
      <RouteStudy
        game={withoutCompatibleAircraft}
        originIata="FCO"
        destinationIata="JFK"
      />,
    );

    const action = screen.getByRole("button", { name: /apri questa rotta/i });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    expect(screen.getByText(/serve un aereo compatibile/i)).toBeInTheDocument();
  });
});
