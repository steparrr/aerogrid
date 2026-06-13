import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { Staff } from "./Staff";

afterEach(cleanup);

function staffGame(): GameState {
  const game = playableStateFixture();
  const fleet = game.fleet.map((aircraft) => ({
    ...aircraft,
    utilizationHoursPerDay: 14,
  }));

  return {
    ...game,
    fleet,
    player: {
      ...game.player,
      fleet,
      staff: {
        pilots_available: 20,
        pilots_required: 26,
        pilots_in_training: 2,
        union_morale: 35,
        union_contract_expires_turn: 3,
        strike_risk: 82,
      },
    },
  };
}

describe("Staff screen", () => {
  it("renders pilot capacity, union morale, contract expiry, and strike warning", () => {
    render(<Staff game={staffGame()} />);

    expect(
      screen.getByRole("heading", { name: "Staff e sindacati" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Piloti disponibili")).toHaveTextContent("20");
    expect(screen.getByLabelText("Piloti richiesti")).toHaveTextContent("26");
    expect(screen.getByLabelText("Piloti in formazione")).toHaveTextContent("2");
    expect(screen.getByLabelText("Morale sindacato")).toHaveTextContent("35%");
    expect(screen.getByText("3 turni")).toBeInTheDocument();
    expect(screen.getByText(/rischio sciopero alto/i)).toBeInTheDocument();
  });

  it("applies HR actions and updates the additional-aircraft cost scenario", () => {
    const onStaffChange = vi.fn();
    render(<Staff game={staffGame()} onStaffChange={onStaffChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Assumi 5 piloti" }));
    expect(screen.getByLabelText("Piloti disponibili")).toHaveTextContent("25");

    fireEvent.click(screen.getByRole("button", { name: "Avvia formazione" }));
    expect(screen.getByLabelText("Piloti in formazione")).toHaveTextContent("7");

    fireEvent.click(screen.getByRole("button", { name: "Rinnovo moderato" }));
    expect(screen.getByLabelText("Morale sindacato")).toHaveTextContent("55%");
    expect(onStaffChange).toHaveBeenCalledTimes(3);

    fireEvent.change(screen.getByLabelText("Aerei aggiuntivi"), {
      target: { value: "3" },
    });
    expect(screen.getByText("33 piloti aggiuntivi")).toBeInTheDocument();
    expect(screen.getByText("$2.5M / anno")).toBeInTheDocument();
  });
});
