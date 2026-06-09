import { describe, expect, it } from "vitest";

import type { GameState } from "../domain/types";
import { playableStateFixture } from "../test/fixtures";
import {
  AUTOSAVE_KEY,
  createGameExport,
  deserializeGame,
  loadAutosavedGame,
  saveGameLocally,
  serializeGame,
} from "./persistence";

describe("versioned game persistence", () => {
  it("round-trips a valid versioned save", () => {
    const state = playableStateFixture();
    const serialized = serializeGame(state, "2027-03-18T12:00:00.000Z");
    const envelope = JSON.parse(serialized) as Record<string, unknown>;

    expect(envelope).toMatchObject({
      schemaVersion: 1,
      savedAt: "2027-03-18T12:00:00.000Z",
    });
    expect(deserializeGame(serialized)).toEqual(state);
  });

  it("rejects corrupted, unsupported, and structurally invalid saves", () => {
    const state = playableStateFixture();
    const unsupported = JSON.stringify({
      schemaVersion: 2,
      savedAt: "2027-03-18T12:00:00.000Z",
      game: state,
    });
    const invalidGame = serializeGame(
      {
        ...state,
        routes: [{ ...state.routes[0], aircraftId: "missing-aircraft" }],
      },
      "2027-03-18T12:00:00.000Z",
    );

    expect(() => deserializeGame("{broken")).toThrow("Invalid save file");
    expect(() => deserializeGame(unsupported)).toThrow("Unsupported save schema");
    expect(() => deserializeGame(invalidGame)).toThrow("Invalid game state");
  });

  it("rejects inconsistent aircraft assignments and unknown game views", () => {
    const state = playableStateFixture();
    const missingAssignment = serializeGame({
      ...state,
      fleet: [{ ...state.fleet[0], assignedRouteIds: [] }],
    });
    const unknownView = serializeGame({
      ...state,
      currentView: "unknown" as GameState["currentView"],
    });

    expect(() => deserializeGame(missingAssignment)).toThrow(
      "Invalid game state",
    );
    expect(() => deserializeGame(unknownView)).toThrow("Invalid game state");
  });

  it("loads a valid autosave and ignores a corrupted one", () => {
    const state = playableStateFixture();
    const storage = new Map<string, string>();
    const adapter: Storage = {
      get length() {
        return storage.size;
      },
      clear: () => storage.clear(),
      getItem: (key) => storage.get(key) ?? null,
      key: (index) => [...storage.keys()][index] ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value),
    };

    saveGameLocally(state, adapter);
    expect(loadAutosavedGame(adapter)).toEqual(state);

    adapter.setItem(AUTOSAVE_KEY, "{broken");
    expect(loadAutosavedGame(adapter)).toBeNull();
  });

  it("creates an exportable JSON blob that can be imported again", async () => {
    const state = playableStateFixture();
    const blob = createGameExport(state);
    const serialized = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsText(blob);
    });

    expect(blob.type).toBe("application/json");
    expect(deserializeGame(serialized)).toEqual(state);
  });
});
