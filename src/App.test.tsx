import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

describe("App", () => {
  it("mostra la schermata nuova partita quando non esiste un salvataggio", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Aerogrid" })).toBeInTheDocument();
  });

  it("mostra il campo nome compagnia nella schermata nuova partita", () => {
    render(<App />);
    const inputs = screen.getAllByPlaceholderText(/Azzurra Airlines/i);
    expect(inputs.length).toBeGreaterThan(0);
  });
});
