import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import { Maintenance } from "./Maintenance";

describe("Maintenance screen", () => {
  it("renders fleet maintenance, scheduler, and fuel hedging data", () => {
    const game = playableStateFixture();
    const onUpdate = vi.fn();

    render(
      <Maintenance
        game={game}
        onNavigate={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Manutenzione & Fuel" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("787-9 Dreamliner").length).toBeGreaterThan(0);
    expect(screen.getByText(/prossimo a-check/i)).toBeInTheDocument();
    expect(screen.getByText(/timeline 12 mesi/i)).toBeInTheDocument();
    expect(screen.getByText(/fuel hedging/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nuovo hedge/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders an empty fleet state", () => {
    const game = {
      ...playableStateFixture(),
      fleet: [],
      routes: [],
    };

    render(<Maintenance game={game} onNavigate={vi.fn()} />);

    expect(screen.getByText("Nessun aeromobile in flotta")).toBeInTheDocument();
  });
});
