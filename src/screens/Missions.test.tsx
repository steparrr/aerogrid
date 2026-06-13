import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MissionProgress } from "../engine/missionEngine";
import { Missions } from "./Missions";

afterEach(cleanup);

describe("Missions screen", () => {
  it("shows the mission catalog with available and locked states", () => {
    render(<Missions onStartMission={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Missioni" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T1 Primo Volo/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /T2 Gestione Costi/i }),
    ).toBeDisabled();
    expect(screen.getByText("Completa T1 prima")).toBeInTheDocument();
    expect(screen.getAllByText(/turni/i).length).toBeGreaterThanOrEqual(5);
  });

  it("opens an available mission preview and starts it", () => {
    const onStartMission = vi.fn();
    render(<Missions onStartMission={onStartMission} />);

    fireEvent.click(screen.getByRole("button", { name: /T1 Primo Volo/i }));

    expect(
      screen.getByRole("heading", { name: "Primo Volo" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Parti con \$100M/i)).toBeInTheDocument();
    expect(screen.getByText(/Apri 2 rotte/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Inizia T1" }));
    expect(onStartMission).toHaveBeenCalledWith(
      expect.objectContaining({ code: "T1" }),
    );
  });

  it("shows earned medals and unlocks the next mission", () => {
    const progress: MissionProgress = {
      T1: { completed: true, best_medal: "GOLD" },
    };

    render(<Missions progress={progress} onStartMission={vi.fn()} />);

    expect(screen.getAllByText("Oro").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /T2 Gestione Costi/i }),
    ).toBeEnabled();
  });
});
