import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RoutePerformance } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { YieldManagement } from "./YieldManagement";

afterEach(cleanup);

function performance(loadFactor: number, index: number): RoutePerformance {
  return {
    date: `2027-03-${String(index + 1).padStart(2, "0")}`,
    passengers: Math.round(280 * loadFactor),
    loadFactor,
    revenue: 100_000,
    costs: 70_000,
    profit: 30_000,
    availableSeatKm: 1_000_000,
  };
}

function yieldGame() {
  const game = playableStateFixture();
  return {
    ...game,
    routes: game.routes.map((route) => ({
      ...route,
      load_factor: 0.2,
      pricing_strategy: "COMPETITOR_MATCH" as const,
      overbooking_level: "MODERATE" as const,
      performanceHistory: Array.from({ length: 10 }, (_, index) =>
        performance(0.2, index),
      ),
    })),
  };
}

describe("YieldManagement screen", () => {
  it("renders route overview and real yield-management detail data", () => {
    render(<YieldManagement game={yieldGame()} />);

    expect(
      screen.getByRole("heading", { name: "Yield Management" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("FCO → JFK").length).toBeGreaterThan(0);
    expect(screen.getByText("Panoramica rotte")).toBeInTheDocument();
    expect(screen.getByText("Booking curve")).toBeInTheDocument();
    expect(screen.getByText("Classi tariffarie")).toBeInTheDocument();
    expect(screen.getAllByText("Flash sale").length).toBeGreaterThan(0);
    expect(screen.getByText("Alert automatici")).toBeInTheDocument();
    expect(screen.getAllByText("BEHIND").length).toBeGreaterThan(0);
  });

  it("reports strategy, overbooking and flash-sale updates through onUpdate", () => {
    const onUpdate = vi.fn();
    const game = yieldGame();
    render(<YieldManagement game={game} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole("combobox", { name: /strategia pricing/i }), {
      target: { value: "PREMIUM" },
    });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({ pricing_strategy: "PREMIUM" }),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "AGGRESSIVE" }));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({ overbooking_level: "AGGRESSIVE" }),
        ],
      }),
    );

    const flashSale = screen.getByRole("region", { name: "Flash sale" });
    fireEvent.click(
      within(flashSale).getByRole("button", { name: /avvia flash sale/i }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(within(flashSale).getByText(/flash sale attiva/i)).toBeInTheDocument();
  });

  it("dismisses automatic alerts without mutating game data", () => {
    const game = yieldGame();
    const snapshot = structuredClone(game);
    render(<YieldManagement game={game} />);

    const alerts = screen.getByRole("region", { name: "Alert automatici" });
    fireEvent.click(
      within(alerts).getByRole("button", { name: /ignora alert .*behind/i }),
    );

    expect(game).toEqual(snapshot);
    expect(
      within(alerts).queryByText(/sotto la booking curve/i),
    ).not.toBeInTheDocument();
  });
});
