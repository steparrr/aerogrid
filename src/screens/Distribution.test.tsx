import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DistributionChannel } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import { Distribution } from "./Distribution";

afterEach(cleanup);

function distributionGame(level: 1 | 2 | 3 | 4 | 5 = 4) {
  const game = playableStateFixture();
  return {
    ...game,
    routes: game.routes.map((route) => ({
      ...route,
      revenue_monthly: 1_000_000,
    })),
    player: {
      ...game.player,
      level,
      core_kpis: {
        ...game.player.core_kpis,
        ancillary_per_pax: 30,
      },
      distribution: {
        channels: ["DIRECT", "GDS", "OTA", "METASEARCH"] as DistributionChannel[],
        channel_mix: {
          DIRECT: 50,
          GDS: 20,
          OTA: 15,
          METASEARCH: 15,
        },
        ndc_migration_turns_remaining: 4,
      },
    },
  };
}

describe("Distribution screen", () => {
  it("shows channel status, traffic allocation and calculated KPIs", () => {
    render(<Distribution game={distributionGame()} />);

    expect(
      screen.getByRole("heading", { name: "Distribuzione" }),
    ).toBeInTheDocument();
    expect(screen.getByText("GDS + Agenzia")).toBeInTheDocument();
    expect(screen.getByText("Corporate / TMC")).toBeInTheDocument();
    expect(screen.getByText("100% allocato")).toBeInTheDocument();
    expect(screen.getByText("Migrazione NDC")).toBeInTheDocument();
    expect(screen.getByText(/4 turni rimanenti/)).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("keeps slider allocation at 100 percent and reports changes", () => {
    const onMixChange = vi.fn();
    render(
      <Distribution game={distributionGame()} onMixChange={onMixChange} />,
    );

    fireEvent.change(screen.getByRole("slider", { name: /diretto/i }), {
      target: { value: "70" },
    });

    expect(screen.getByText("100% allocato")).toBeInTheDocument();
    expect(onMixChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ DIRECT: 70 }),
    );
  });

  it("marks unavailable channels as locked with their required level", () => {
    render(<Distribution game={distributionGame(1)} />);

    expect(screen.getAllByText(/Livello 2 richiesto/)).toHaveLength(2);
    expect(screen.getByText(/Livello 3 richiesto/)).toBeInTheDocument();
    expect(screen.getByText(/Livello 4 richiesto/)).toBeInTheDocument();
    expect(screen.queryByText("Migrazione NDC")).not.toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /gds/i }),
    ).toBeDisabled();
  });
});
