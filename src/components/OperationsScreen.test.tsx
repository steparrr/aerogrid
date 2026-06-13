import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { playableStateFixture } from "../test/fixtures";
import { OperationsScreen } from "./OperationsScreen";

describe("OperationsScreen system navigation", () => {
  it("exposes the advanced operational systems", () => {
    const onNavigate = vi.fn();

    render(
      <OperationsScreen
        game={playableStateFixture()}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manutenzione/i }));
    expect(onNavigate).toHaveBeenCalledWith("maintenance");

    expect(screen.getByRole("button", { name: /yield management/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /missioni/i })).toBeInTheDocument();
  });
});
