import { useState } from "react";
import { AUTOSAVE_KEY, serializeGame } from "../game/persistence";
import { saveGameLocally } from "../game/persistence";
import { aircraftModelById } from "../data/indexes";
import { airportByIata } from "../data/indexes";
import { useGame } from "../game/gameContext";

const PERSIST_TEST_KEY = "__aerogrid_persist_test__";
// Write a timestamp on every load — if it survives a refresh, localStorage is persistent
try {
  const existing = localStorage.getItem(PERSIST_TEST_KEY);
  if (!existing) {
    localStorage.setItem(PERSIST_TEST_KEY, new Date().toISOString());
  }
} catch { /* ignore */ }

const VALID_ACQUISITION_TYPES = new Set(["owned", "leased", "acmi", "sale_leaseback"]);
const VALID_VIEWS = new Set([
  "operations","rotations","yield","route-study","maintenance","distribution",
  "staff","progression","missions","market","airports","world-map",
  "airport-conceptual","airport-physical","terminal-map","aircraft-catalog",
  "competitors","planner","routes","fleet","finance","contracts","debug",
]);

function diagnose(raw: string): { ok: boolean; lines: { label: string; ok: boolean; detail: string }[] } {
  const lines: { label: string; ok: boolean; detail: string }[] = [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, lines: [{ label: "JSON parse", ok: false, detail: "JSON non valido" }] };
  }

  const g = parsed.game as Record<string, unknown> | undefined;
  if (!g) return { ok: false, lines: [{ label: "envelope.game", ok: false, detail: "campo game mancante" }] };

  const check = (label: string, ok: boolean, detail = "") => lines.push({ label, ok, detail });

  check("schemaVersion", g.schemaVersion === 1, String(g.schemaVersion));
  check("airlineName", typeof g.airlineName === "string" && (g.airlineName as string).trim().length >= 2, String(g.airlineName));
  check("hubIata", typeof g.hubIata === "string" && airportByIata.has(g.hubIata as string), String(g.hubIata));
  check("cash", typeof g.cash === "number" && Number.isFinite(g.cash), String(g.cash));
  check("currentDate", typeof g.currentDate === "string", String(g.currentDate));
  check("currentView", typeof g.currentView === "string" && VALID_VIEWS.has(g.currentView as string), String(g.currentView));

  const fleet = g.fleet as unknown[];
  if (!Array.isArray(fleet)) {
    check("fleet", false, "non è un array");
  } else {
    check("fleet (è array)", true, `${fleet.length} aerei`);
    fleet.forEach((ac, i) => {
      const a = ac as Record<string, unknown>;
      const modelOk = typeof a.modelId === "string" && aircraftModelById.has(a.modelId as string);
      const acqOk = typeof a.acquisitionType === "string" && VALID_ACQUISITION_TYPES.has(a.acquisitionType as string);
      if (!modelOk) check(`fleet[${i}] modelId`, false, String(a.modelId));
      if (!acqOk)   check(`fleet[${i}] acquisitionType`, false, String(a.acquisitionType));
    });
    const allOk = fleet.every(ac => {
      const a = ac as Record<string, unknown>;
      return aircraftModelById.has(a.modelId as string) && VALID_ACQUISITION_TYPES.has(a.acquisitionType as string);
    });
    if (allOk && fleet.length > 0) check("fleet (tutti validi)", true, "");
  }

  const routes = g.routes as unknown[];
  if (!Array.isArray(routes)) {
    check("routes", false, "non è un array");
  } else {
    check("routes (è array)", true, `${routes.length} rotte`);
    routes.forEach((r, i) => {
      const route = r as Record<string, unknown>;
      if (!airportByIata.has(route.originIata as string))      check(`route[${i}] originIata`, false, String(route.originIata));
      if (!airportByIata.has(route.destinationIata as string)) check(`route[${i}] destinationIata`, false, String(route.destinationIata));
      if (route.status !== "active" && route.status !== "suspended") check(`route[${i}] status`, false, String(route.status));
    });
  }

  const npcs = g.npcAirlines as unknown[];
  check("npcAirlines", Array.isArray(npcs) && npcs.length > 0, Array.isArray(npcs) ? `${npcs.length} NPC` : "non è array");

  const reports = g.reports as Record<string, unknown> | undefined;
  check("reports", !!reports && Array.isArray(reports.daily) && Array.isArray(reports.weekly),
    reports ? `daily:${(reports.daily as unknown[])?.length} weekly:${(reports.weekly as unknown[])?.length}` : "mancante");

  const dbg = g.debug as Record<string, unknown> | undefined;
  check("debug", !!dbg && Array.isArray(dbg.errors) && Array.isArray(dbg.npcEvents), dbg ? "ok" : "mancante");

  const allOk = lines.every(l => l.ok);
  return { ok: allOk, lines };
}

export function SaveDebugPanel() {
  const { state } = useGame();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof diagnose> | null>(null);
  const [saveSize, setSaveSize] = useState<number | null>(null);
  const [storageTest, setStorageTest] = useState<{ writable: boolean; allKeys: string[]; liveSize: number | null; persistTestSurvived: boolean; persistTestTime: string } | null>(null);
  const [forceSaveMsg, setForceSaveMsg] = useState<string | null>(null);
  const loadError = (window as Record<string, unknown>).__aerogrid_load_error as string | null | undefined;

  function run() {
    let writable = false;
    const TEST_KEY = "__aerogrid_test__";
    try {
      localStorage.setItem(TEST_KEY, "ok");
      writable = localStorage.getItem(TEST_KEY) === "ok";
      localStorage.removeItem(TEST_KEY);
    } catch { writable = false; }

    const allKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
      }
    } catch { /* ignore */ }

    // Persist test: write now, survived if already present from before
    let persistTestSurvived = false;
    let persistTestTime = "";
    try {
      const val = localStorage.getItem(PERSIST_TEST_KEY);
      if (val) {
        persistTestSurvived = true;
        persistTestTime = val;
      } else {
        localStorage.setItem(PERSIST_TEST_KEY, new Date().toISOString());
      }
    } catch { /* ignore */ }

    // Calcola dimensione live del save corrente
    let liveSize: number | null = null;
    if (state) {
      try {
        liveSize = serializeGame(state).length;
      } catch { /* ignore */ }
    }

    setStorageTest({ writable, allKeys, liveSize, persistTestSurvived, persistTestTime });

    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) {
        setResult({ ok: false, lines: [{ label: "localStorage", ok: false, detail: "Nessun save trovato! La chiave " + AUTOSAVE_KEY + " è vuota." }] });
        setSaveSize(null);
      } else {
        setSaveSize(raw.length);
        setResult(diagnose(raw));
      }
    } catch {
      setResult({ ok: false, lines: [{ label: "localStorage", ok: false, detail: "Accesso negato al localStorage" }] });
    }
    setOpen(true);
  }

  function forceSave() {
    if (!state) { setForceSaveMsg("Nessuna partita attiva da salvare"); return; }
    try {
      saveGameLocally(state);
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      setForceSaveMsg(raw ? `✓ Salvato! ${(raw.length / 1024).toFixed(1)} KB` : "✗ Scrittura fallita silenziosamente");
    } catch (e) {
      setForceSaveMsg(`✗ Errore: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <button
        onClick={run}
        style={{
          position: "fixed", top: 12, right: 12, zIndex: 99999,
          background: "#F59E0B", border: "none",
          borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 800,
          color: "#0A1220", cursor: "pointer", boxShadow: "0 2px 12px #F59E0B88",
        }}>
        🔍 Diagnosi
      </button>

      {open && result && (
        <div style={{
          position: "fixed", inset: 0, background: "#000000CC", zIndex: 100000,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setOpen(false)}>
          <div style={{
            background: "#0A1220", border: "1px solid #1E2D45",
            borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600,
            maxHeight: "85vh", overflowY: "auto", padding: 16,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#F8FAFC" }}>Diagnosi Salvataggio</span>
                {saveSize !== null && <span style={{ fontSize: 11, color: "#64748B", marginLeft: 8 }}>su disco: {(saveSize / 1024).toFixed(1)} KB</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: result.ok ? "#0F2A1F" : "#2A0A0A",
                  color: result.ok ? "#34D399" : "#F87171",
                }}>
                  {result.ok ? "✓ VALIDO" : "✗ INVALIDO"}
                </span>
                <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#64748B", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
            </div>

            {/* Errore caricamento */}
            {loadError && (
              <div style={{ background: "#2A1A00", border: "1px solid #F59E0B", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>ERRORE CARICAMENTO (al refresh)</div>
                <div style={{ fontSize: 12, color: "#FCD34D", fontFamily: "monospace" }}>{loadError}</div>
              </div>
            )}

            {/* Stato partita live */}
            <div style={{ background: "#0A1220", border: "1px solid #1E2D45", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 4 }}>PARTITA IN MEMORIA</div>
              <div style={{ fontSize: 12, color: state ? "#34D399" : "#F87171" }}>
                {state ? `✓ Attiva — ${state.airlineName} · ${state.fleet.length} aerei · ${state.routes.length} rotte` : "✗ Nessuna partita caricata (sei sul New Game screen)"}
              </div>
              {storageTest?.liveSize != null && (
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                  Dimensione save live: {(storageTest.liveSize / 1024).toFixed(1)} KB
                  {storageTest.liveSize > 4 * 1024 * 1024 && <span style={{ color: "#F59E0B", marginLeft: 6 }}>⚠ Vicino al limite 5MB Safari</span>}
                </div>
              )}
              <button
                onClick={forceSave}
                style={{
                  marginTop: 8, padding: "6px 14px", borderRadius: 8,
                  background: state ? "#0F2A3F" : "#1A1A2A", border: `1px solid ${state ? "#00C8FF" : "#333"}`,
                  color: state ? "#00C8FF" : "#555", fontSize: 12, fontWeight: 700,
                  cursor: state ? "pointer" : "not-allowed",
                }}>
                💾 Forza salvataggio ora
              </button>
              {forceSaveMsg && <div style={{ fontSize: 11, color: "#34D399", marginTop: 4 }}>{forceSaveMsg}</div>}
            </div>

            {/* Storage test */}
            {storageTest && (
              <div style={{ background: "#0A1220", border: "1px solid #1E2D45", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>TEST LOCALSTORAGE</div>
                <div style={{ fontSize: 12, color: storageTest.writable ? "#34D399" : "#F87171", marginBottom: 2 }}>
                  {storageTest.writable ? "✓ Scrittura OK" : "✗ Scrittura BLOCCATA (Safari ITP o Private Mode)"}
                </div>
                <div style={{ fontSize: 12, marginBottom: 2, color: storageTest.persistTestSurvived ? "#34D399" : "#F59E0B" }}>
                  {storageTest.persistTestSurvived
                    ? `✓ localStorage PERSISTE tra i refresh (scritto: ${storageTest.persistTestTime.slice(11,19)})`
                    : "⚠ TEST: primo carico — refresha e riapri questo pannello per confermare"}
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  Chiavi presenti: {storageTest.allKeys.length === 0 ? "nessuna" : storageTest.allKeys.join(", ")}
                </div>
              </div>
            )}

            {!result.ok && saveSize !== null && (
              <div style={{ background: "#2A0A0A", border: "1px solid #F87171", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#F87171" }}>
                Il salvataggio esiste ma fallisce la validazione — questo causava il reset. Guarda i campi rossi qui sotto.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {result.lines.map((l, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "7px 10px", borderRadius: 6,
                  background: l.ok ? "#0A1A0A" : "#1A0A0A",
                  border: `1px solid ${l.ok ? "#1A3A1A" : "#3A1A1A"}`,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{l.ok ? "✓" : "✗"}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: l.ok ? "#34D399" : "#F87171" }}>{l.label}</span>
                    {l.detail && <span style={{ fontSize: 11, color: "#64748B", marginLeft: 8 }}>{l.detail}</span>}
                  </div>
                </div>
              ))}
            </div>

            {!result.ok && (
              <button
                onClick={() => {
                  if (confirm("Cancella il salvataggio corrotto e ricomincia?")) {
                    localStorage.removeItem(AUTOSAVE_KEY);
                    setOpen(false);
                    window.location.reload();
                  }
                }}
                style={{
                  marginTop: 14, width: "100%", padding: 12, borderRadius: 10,
                  background: "#2A0A0A", border: "1px solid #F87171",
                  color: "#F87171", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                🗑 Cancella save corrotto e ricomincia
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
