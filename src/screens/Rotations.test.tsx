import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import { Rotations } from "./Rotations";

describe("Rotations screen", () => {
  it("renders the real fleet schedule and aircraft details", () => {
    const game = playableStateFixture();
    const onNavigate = vi.fn();
    const onUpdate = vi.fn();

    render(
      <Rotations game={game} onNavigate={onNavigate} onUpdate={onUpdate} />,
    );

    expect(
      screen.getByRole("heading", { name: "Rotazioni" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("FCO → JFK")).toHaveLength(2);
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(screen.getAllByText(/ore di volo/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Utilizzo" }));
    expect(screen.getByText(/target giornaliero/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alert" }));
    expect(screen.getByText(/sovrautilizzo|sottoutilizzo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Centro" }));
    expect(onNavigate).toHaveBeenCalledWith("operations");

    fireEvent.click(
      screen.getByRole("button", { name: /esegui a-check preventivo/i }),
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders a useful empty state when no aircraft are available", () => {
    const game = {
      ...playableStateFixture(),
      fleet: [],
      routes: [],
    };

    render(<Rotations game={game} onNavigate={vi.fn()} />);

    expect(screen.getByText("Nessuna rotazione pianificata")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vai alla flotta/i }),
    ).toBeInTheDocument();
  });
});
